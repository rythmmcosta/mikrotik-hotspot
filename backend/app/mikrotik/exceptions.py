class RouterOSError(Exception):
    pass


class RouterOSConnectionError(RouterOSError):
    pass


class RouterOSCommandError(RouterOSError):
    def __init__(self, message: str, category: str = "", detail: str = ""):
        super().__init__(message)
        self.category = category
        self.detail = detail
