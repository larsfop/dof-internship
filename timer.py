import time

class Timer:
    def __init__(self, pdf: str = None):
        self.pdf = pdf
        self.start_time = time.time()

    def __enter__(self):
        if self.pdf is not None:
            print(f'{"-" * 150}')
            print(f'{"PROCESSING PDF":^150}')
            print(f'{self.pdf:^150}')
            print(f'{"-" * 150}\n')
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        print(f'\nFinished processing table in {time.time() - self.start_time:.2f} seconds')
        print(f'{"-" * 150}\n')