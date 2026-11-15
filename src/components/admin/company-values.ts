/** Company form values (plain module: usable by server and client code). */

export type CompanyFieldValues = {
  name: string;
  legalForm: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  registrationNo: string;
  contactPerson: string;
  email: string;
  phone: string;
};

export const EMPTY_COMPANY: CompanyFieldValues = {
  name: "",
  legalForm: "",
  address: "",
  postalCode: "",
  city: "",
  country: "DE",
  registrationNo: "",
  contactPerson: "",
  email: "",
  phone: "",
};
