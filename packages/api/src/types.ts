export interface DbUser {
  id: string;
  name: string | null;
  email: string | null;
  phoneNumber: string | null;
  password: string | null;
  category: string | null;
  vehicleNumber: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  role: string | null;
  active: boolean | null;
}

export interface GroupedMembers {
  "operational team": {
    driver: DbUser[];
    catcher: DbUser[];
  };
  "surgical team": {
    surgeon: DbUser[];
    "medical assistant": DbUser[];
  };
  "shelter team": {
    "ward boy": DbUser[];
  };
}
