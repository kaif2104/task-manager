pipeline {
    agent any

    environment {
        DOCKER_IMAGE = 'kaif03/todo'
        SERVER2_IP   = '172.31.168.75'
    }

    stages {
        stage('1. Checkout Code') {
            steps {
                echo 'Checking out source code...'
            }
        }

        stage('2. Security Gate: Gitleaks Secret Scan') {
            steps {
                sh '''
                    echo "Running Gitleaks Secret Scanner..."
                    gitleaks detect --source . --verbose --no-git || true
                    gitleaks detect --source . --no-git
                '''
            }
        }

        stage('3. SAST: SonarQube Code Analysis') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh '''
                        echo "Running SonarQube Scan..."
                        /var/jenkins_home/tools/hudson.plugins.sonar.SonarRunnerInstallation/SonarScanner/bin/sonar-scanner \
                        -Dsonar.projectKey=todo-app-devsecops \
                        -Dsonar.sources=. \
                        -Dsonar.host.url=http://13.235.106.204:9000 \
                        -Dsonar.exclusions="node_modules/**" || true
                    '''
                }
            }
        }

        stage('4. Docker Build & Push to Registry') {
            steps {
                script {
                    docker.withRegistry('https://index.docker.io/v1/', 'docker-hub-credentials') {
                        def customImage = docker.build("${DOCKER_IMAGE}:${BUILD_NUMBER}")
                        def latestImage = docker.build("${DOCKER_IMAGE}:latest")
                        customImage.push()
                        latestImage.push()
                    }
                }
            }
        }

        stage('5. Determine Active Target (Blue/Green)') {
            steps {
                sshagent(['server2-ssh-key']) {
                    script {
                        def activePort = sh(
                            script: "ssh -o StrictHostKeyChecking=no ubuntu@${SERVER2_IP} 'grep -i \"server 127\" /etc/nginx/sites-available/default || echo 8081'",
                            returnStdout: true
                        ).trim()
                        
                        if (activePort.contains("8081")) {
                            env.TARGET_COLOR = "green"
                            env.TARGET_PORT = "8082"
                            env.IDLE_COLOR = "blue"
                        } else {
                            env.TARGET_COLOR = "blue"
                            env.TARGET_PORT = "8081"
                            env.IDLE_COLOR = "green"
                        }
                        echo "Active Port: ${activePort}. Deploying to TARGET: ${env.TARGET_COLOR} (Port ${env.TARGET_PORT})"
                    }
                }
            }
        }

        stage('6. Deploy to Server 2 Container') {
            steps {
                sshagent(['server2-ssh-key']) {
                    sh '''
                        ssh -o StrictHostKeyChecking=no ubuntu@${SERVER2_IP} "
                            docker pull ${DOCKER_IMAGE}:latest
                            docker stop app-${TARGET_COLOR} || true
                            docker rm app-${TARGET_COLOR} || true
                            docker run -d --name app-${TARGET_COLOR} \
                              -p ${TARGET_PORT}:8080 \
                              -e PORT=8080 \
                              -e DB_HOST=172.31.168.75 \
                              -e DB_USER=todouser \
                              -e DB_PASS=todopassword \
                              -e DB_NAME=tododb \
                              -e APP_VERSION=build-${BUILD_NUMBER}-${TARGET_COLOR} \
                              --restart always \
                              ${DOCKER_IMAGE}:latest
                        "
                    '''
                }
            }
        }

        stage('7. Automated DB Migration') {
            steps {
                sshagent(['server2-ssh-key']) {
                    sh '''
                        sleep 3
                        echo "Executing DB Migration on target container..."
                        curl -s -f -X POST http://${SERVER2_IP}:${TARGET_PORT}/api/migrate
                    '''
                }
            }
        }

        stage('8. Post-Deploy Health Check & Traffic Switch') {
            steps {
                sshagent(['server2-ssh-key']) {
                    script {
                        try {
                            echo "Validating health of target container on Port ${env.TARGET_PORT}..."
                            sh "ssh -o StrictHostKeyChecking=no ubuntu@${SERVER2_IP} 'curl -s -f http://localhost:${env.TARGET_PORT}/api/health'"
                            
                            echo "Health check PASSED! Switching Nginx traffic to ${env.TARGET_COLOR}..."
                            sh "ssh -o StrictHostKeyChecking=no ubuntu@${SERVER2_IP} '/var/www/app/switch_traffic.sh ${env.TARGET_COLOR}'"
                        } catch (Exception e) {
                            echo "CRITICAL: Health check FAILED! Executing AUTO-ROLLBACK..."
                            sh "ssh -o StrictHostKeyChecking=no ubuntu@${SERVER2_IP} '/var/www/app/switch_traffic.sh ${env.IDLE_COLOR}'"
                            error("Deployment aborted and rolled back due to failed health check!")
                        }
                    }
                }
            }
        }
    }
}