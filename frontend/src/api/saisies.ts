// src/api/saisies.ts
import apiClient from './apiClient';

export interface MonthlyInput {
  id: string;
  employee_id: string;
  year: number;
  month: number;
  name: string;
  description?: string;
  amount: number;
  soumise_a_csg?: boolean;
  created_at: string;
  updated_at: string;
}

// --- API Monthly Inputs ---
export const getAllMonthlyInputs = (year: number, month: number) => {
  return apiClient.get<MonthlyInput[]>('/api/monthly-inputs', { params: { year, month } });
};

export const createMonthlyInput = (data: Omit<MonthlyInput, 'id' | 'created_at' | 'updated_at'>[]) => {
  // envoi brut du tableau, sans l'encapsuler dans un objet
  return apiClient.post('/api/monthly-inputs', data, {
    headers: { 'Content-Type': 'application/json' },
  });
};


export const deleteMonthlyInput = (id: string) => {
  return apiClient.delete(`/api/monthly-inputs/${id}`);
};

export const getEmployeeMonthlyInputs = (employeeId: string, year: number, month: number) => {
  return apiClient.get(`/api/employees/${employeeId}/monthly-inputs`, {
    params: { year, month },
  });
};

export const deleteEmployeeMonthlyInput = (employeeId: string, inputId: string) => {
  return apiClient.delete(`/api/employees/${employeeId}/monthly-inputs/${inputId}`);
};


