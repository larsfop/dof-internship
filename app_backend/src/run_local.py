
import os

os.environ['DATA_PATH'] = '../volumes/data/'
os.environ['MILVUS_HOST'] = 'localhost'
os.environ['MILVUS_PORT'] = '19530'

from vectorDB import document_retrieval, generate_query_or_response


if __name__ == "__main__":
    response = generate_query_or_response(
        {'messages': [
            {'role': 'user', 'content': 'What are the values of kmod in Eurocode 5?'}
        ]}
    )
    print(response)