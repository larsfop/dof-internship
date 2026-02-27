import psycopg
import os
from argparse import ArgumentParser
from uuid import uuid4

from database import create_user
from user_authentication import get_password_hash

def new_user(username, password):
    hashed_password = get_password_hash(password)
    create_user(str(uuid4()), username, hashed_password)
    

if __name__ == "__main__":
    parser = ArgumentParser()
    parser.add_argument("-u", "--username", help="Username for the new user")
    parser.add_argument("-p", "--password", help="Password for the new user")
    args = parser.parse_args()


    new_user(args.username, args.password)
