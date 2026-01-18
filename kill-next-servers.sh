#!/bin/bash
# Script to kill all next-server processes and restart cleanly

echo "Killing all next-server processes..."
pkill -f "next-server" || echo "No next-server processes found"

echo "Waiting 2 seconds for processes to terminate..."
sleep 2

echo "Checking for remaining processes..."
ps aux | grep "next-server" | grep -v grep || echo "All next-server processes killed"

echo "Done! You can now start a single Next.js server."
