from langchain_core.prompts import ChatPromptTemplate

from config import CONFIG
from pdf import create_pdfs_from_embeddings
from ..utils import GradeResults, get_vector_retriever, State, get_check_model
    

def retrieve_documents(state: State):

    question = state['messages'][-1].content
    documents = get_vector_retriever().invoke(question)

    # for doc in documents:
    #     print(f'Document: {doc.metadata["document_name"]} ; Pages: {doc.metadata["page_indices"]}', flush=True)

    prompt = ChatPromptTemplate.from_messages([
        (key, value) for item in CONFIG.prompts['rerank_prompt'] for key, value in item.items()
    ])
    chain = prompt | get_check_model().with_structured_output(schema=GradeResults)
    response = chain.invoke({
        'question': question,
        'documents': [{'document': doc.page_content, 'metadata': doc.metadata} for doc in documents]
    })

    # for result in response:
    #     print(f'Document: {result.document_name} ; Pages: {result.pages} ; Score: {result.score}', flush=True)

    pdf_data = create_pdfs_from_embeddings(response)

    return {'documents': pdf_data}