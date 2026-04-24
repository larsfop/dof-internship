$DockerPath = "$env:ProgramFiles/dof-pdf/docker-compose.yml"

docker compose -f $DockerPath up -d --build