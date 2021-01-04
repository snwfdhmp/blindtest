#!/bin/zsh
/usr/bin/git pull origin master --ff-only && /usr/local/bin/docker-compose -f release/nas/docker-compose.yml up --build -d
