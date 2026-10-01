#!/bin/bash
cd "/home/ubuntu/Aegis/Boarder patroling/backend"
source venv/bin/activate
exec uvicorn app.main:app --host 127.0.0.1 --port 8000
