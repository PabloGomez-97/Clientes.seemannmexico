export interface PackageType {
  code: any;
  id: number;
  name: string;
}

export const packageTypeOptions: PackageType[] = [
    {
      id: 97, name: "BOX",
      code: undefined
    },
    {
      id: 57, name: "CARTON",
      code: undefined
    },
    {
      id: 110, name: "CARGA GENERAL",
      code: undefined
    }
];