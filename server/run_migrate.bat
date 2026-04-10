@echo off
cd /d "%~dp0"
node_modules\.bin\prisma db push
node_modules\.bin\prisma generate
echo Done.
