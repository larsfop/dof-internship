#!/bin/bash

# Setup backend environment
docker compose build
docker compose up

# Recreate database
xdg-open http://localhost:4000/recreate-database