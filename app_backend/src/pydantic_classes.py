from pydantic import BaseModel, Field
from typing import Optional, List, Self, Tuple, Any, Literal
from langchain_core.callbacks.base import BaseCallbackHandler
from langgraph.graph import MessagesState
from langmem.short_term import RunningSummary


#---------------------------------------------------------------
#                   RAG related classes
#---------------------------------------------------------------


class MetadataCallback(BaseCallbackHandler):
    def __init__(self):
        self.metadata = {}

    def on_llm_start(self, serialized, prompts, **kwargs):
        self.metadata["run_id"] = str(kwargs.get("run_id"))
        self.metadata["model_name"] = serialized['kwargs'].get("model_name")

    def on_llm_end(self, response, run_id, **kwargs):
        print(response.generations[0][0].generation_info, flush=True)
        metadata = response.generations[0][0].generation_info

        if metadata:
            self.metadata["run_id"] = str(run_id)
            self.metadata["model_name"] = metadata.get("model_name", "")

            usage = metadata.get("token_usage", {})
            self.metadata["prompt_tokens"] = usage.get("prompt_tokens", 0)
            self.metadata["completion_tokens"] = usage.get("completion_tokens", 0)
            self.metadata["total_tokens"] = usage.get("total_tokens", 0)


class Citations(BaseModel):
    documentName: str
    pageLabels: List[str]
    pdfPageNumbers: List[int]


class ResponseMetadata(BaseModel):
    run_id: str
    model_name: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class ResponseOutput(BaseModel):
    content: str
    summaryTitle: str
    citations: List[Citations]
    responseMetadata: ResponseMetadata


    def fill_metadata(self, metadata: MetadataCallback) -> None:
        self.responseMetadata = ResponseMetadata(
            run_id=metadata.metadata.get('run_id', ''),
            model_name=metadata.metadata.get('model_name', ''),
            prompt_tokens=metadata.metadata.get('prompt_tokens', 0),
            completion_tokens=metadata.metadata.get('completion_tokens', 0),
            total_tokens=metadata.metadata.get('total_tokens', 0),
    )


    def update_citation_pages(self, new_pdf_pages: list[int], new_page_labels: list[str], document_name: str) -> None:
        for citation in self.citations:
            print(citation.model_dump(), flush=True)
            if citation.documentName == document_name:
                print(citation.pdfPageNumbers, citation.pageLabels, flush=True)
                try:
                    try:
                        citation.pdfPageNumbers = [new_pdf_pages[page - 1] + 1 for page in citation.pdfPageNumbers]
                        citation.pageLabels = [new_page_labels[page - 1] for page in citation.pdfPageNumbers]
                    except:
                        citation.pdfPageNumbers = [new_pdf_pages[new_page_labels.index(page_label)] for page_label in citation.pageLabels]
                        citation.pageLabels = [new_page_labels[new_pdf_pages.index(page)] for page in citation.pdfPageNumbers]
                except:
                    print(f"Could not update citation pages for document {document_name}", flush=True)


class RerankedDocument(BaseModel):
    pk: str
    documentName: str
    pages: List[int]
    pageLabels: List[int]
    score: float


    def values(self) -> Tuple[str, List[int], List[int], float]:
        return (self.documentName, self.pages, self.pageLabels, self.score)
    

class RerankResults(BaseModel):
    documents: List[RerankedDocument]
    # responseMetadata: ResponseMetadata


    def fill_metadata(self, metadata: MetadataCallback) -> None:
        self.responseMetadata = ResponseMetadata(
            run_id=metadata.metadata.get('run_id', ''),
            model_name=metadata.metadata.get('model_name', ''),
            prompt_tokens=metadata.metadata.get('prompt_tokens', 0),
            completion_tokens=metadata.metadata.get('completion_tokens', 0),
            total_tokens=metadata.metadata.get('total_tokens', 0),
    )


    def __getitem__(self, index: int) -> RerankedDocument:
        return self.documents[index]
    

    def __iter__(self):
        for doc in self.documents:
            yield doc
    

    def __len__(self) -> int:
        return len(self.documents)
    

    def filter_by_score(self, threshold: float) -> Self:
        filtered_docs = [doc for doc in self.documents if doc.score > threshold]
        return RerankResults(documents=filtered_docs)
    

    def merge_same_documents(self) -> Self:
        for i in range(len(self.documents)):
            for j in range(len(self.documents) - 1, i, -1):
                if self.documents[i].documentName == self.documents[j].documentName:
                    # Merge page labels and pages
                    self.documents[i].pageLabels = list(set(self.documents[i].pageLabels + self.documents[j].pageLabels))
                    self.documents[i].pages = list(set(self.documents[i].pages + self.documents[j].pages))
                    # Remove the duplicate document
                    del self.documents[j]

        return self


class GradeDocument(BaseModel):
    """Document with its relevance score."""

    document_name: str = Field(
        description="The name or identifier of the document"
    )
    pages: List[int] = Field(
        description="The pages of the document"
    )
    page_labels: List[int] = Field(
        description="The page labels of the document"
    )
    score: float = Field(
        description="Relevance score between 0 and 1"
    )


    def values(self) -> Tuple[str, List[int], List[int], float]:
        return (self.document_name, self.pages, self.page_labels, self.score)


class GradeResults(BaseModel):
    """List of documents with their relevance scores."""

    documents: List[GradeDocument] = Field(
        description="List of documents with relevance scores"
    )


    def __getitem__(self, index: int) -> GradeDocument:
        return self.documents[index]
    

    def __iter__(self):
        for doc in self.documents:
            yield doc
    

    def __len__(self) -> int:
        return len(self.documents)
    

    def filter_by_score(self, threshold: float) -> Self:
        filtered_docs = [doc for doc in self.documents if doc.score >= threshold]
        return GradeResults(documents=filtered_docs)
    

    def merge_same_documents(self) -> Self:
        for i in range(len(self.documents)):
            for j in range(len(self.documents) - 1, i, -1):
                if self.documents[i].document_name == self.documents[j].document_name:
                    # Merge page labels and pages
                    self.documents[i].page_labels = list(set(self.documents[i].page_labels + self.documents[j].page_labels))
                    self.documents[i].pages = list(set(self.documents[i].pages + self.documents[j].pages))
                    # Remove the duplicate document
                    del self.documents[j]

        return self
    

class Citation(BaseModel):
    documentName: str = Field(
        description='The full name of the pdf document'
    )
    pageLabels: List[str] = Field(
        description='List of the pdf page labels'
    )
    pdfPages: List[int] = Field(
        description='List of the 0th-index pdf indices'
    )


class ResponseOutput(BaseModel):
    response: str = Field(
        description="The answer generated by the model"
    )
    summaryTitle: str = Field(
        description="A brief title summarizing the answer"
    )
    citations: List[Citation] = Field(
        description="List of citations used in the answer"
    )

    def __contains__(self, document_name: str) -> bool:
        for citation in self.citations:
            if citation.documentName == document_name:
                return True
        return False
    
    def __getitem__(self, document_name: str) -> Citation | None:
        for citation in self.citations:
            if citation.documentName == document_name:
                return citation
        return None
    
    def update_citation_pages(self, new_pdf_pages: list[int], new_page_labels: list[str], document_name: str) -> None:
        if document_name not in self:
            return
        
        citation = self[document_name]
        if citation is None:
            return
        
        try:
            indices = citation.pdfPages
            citation.pdfPages = [new_pdf_pages[index] + 1 for index in indices]
            citation.pageLabels = [new_page_labels[index] for index in indices]
        except:
            print('Not able to write citation!')


class CheckResponse(BaseModel):
    """Determine whether to retrieve documents or generate an answer."""
    retrieve_documents: Literal['yes', 'no'] = Field(
        description="Whether to retrieve documents ('yes' or 'no')"
    )


class DocumentPDF(BaseModel):
    name: str
    pages: List[int]
    pageLabels: List[int]
    data: str


class State(MessagesState):
    context: dict[str, RunningSummary]
    documents: List[DocumentPDF]
    parsed: ResponseOutput
    cache: dict[str, Any]


def extract_token_usage(result) -> dict[str, int]:
    if result.llm_output and "token_usage" in result.llm_output:
        return result.llm_output["token_usage"]

    # fallback to first generation
    gen = result.generations[0][0]
    return gen.usage_metadata


class TokenUsage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    reasoning_tokens: int = 0


class ResponseMetadata(BaseCallbackHandler):
    run_id: str = ''
    token_usage: TokenUsage = TokenUsage()

    def on_llm_end(self, response, run_id, **kwargs):
        self.run_id = run_id

        token_usage = extract_token_usage(response)

        self.token_usage.prompt_tokens += token_usage.get('prompt_tokens', 0)
        self.token_usage.completion_tokens += token_usage.get('completion_tokens', 0)
        self.token_usage.total_tokens += token_usage.get('total_tokens', 0)

        details = token_usage.get('completion_tokens_details', {})
        self.token_usage.reasoning_tokens += details.get('reasoning_tokens', 0)


    def __repr__(self):
        return (
            f'ResponseMetadata(run_id={self.run_id}, '
            f'TokenUsage({self.token_usage}))'
        )
    

    def as_dict(self) -> dict[str, int]:
        return {
            'run_id': self.run_id,
            'token_usage': self.token_usage.model_dump()
        }
    