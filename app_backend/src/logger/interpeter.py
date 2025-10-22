

class BaseInterpeter:
    def __init__(self):
        pass


    def interpete_vector_search(
            self,
            data
        ):
        pass


    def interpete_response(
            self,
            data
        ):
        pass



class LangchainInterpeter(BaseInterpeter):
    def __init__(self):
        super().__init__()


    def interpete_vector_search(
            self,
            data
        ):
        # Implement Langchain specific vector search interpretation
        pass


    def interpete_response(
            self,
            data
        ):
        # Implement Langchain specific response interpretation
        pass