export const EQUIPMENT_TYPES = [
  "split",
  "ventana",
  "cassette",
  "piso-techo",
  "VRV",
  "otro",
] as const;

export const EQUIPMENT_TYPE_LABELS: Record<string, string> = {
  split: "Split",
  ventana: "Ventana",
  cassette: "Cassette",
  "piso-techo": "Piso-techo",
  VRV: "VRV",
  otro: "Otro",
};

export const REFRIGERANTS = ["R22", "R410A", "R32", "R290", "otro"] as const;
