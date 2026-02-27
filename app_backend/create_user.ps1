param(
    [string(Mandatory=$true, HelpMessage="Enter the username for the new user", Position=0)]$username,
    [string(Mandatory=$true, HelpMessage="Enter the password for the new user", Position=1)]$password
)

docker exec -it backend python3 src/create_user.py -u $username -p $password