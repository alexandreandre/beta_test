# backend_api/schemas/payslip.py

from pydantic import BaseModel

class PayslipRequest(BaseModel):
    employee_id: str
    year: int
    month: int

class ContractResponse(BaseModel):
    url: str | None = None

class PayslipInfo(BaseModel):
    id: str
    name: str
    month: int
    year: int
    url: str