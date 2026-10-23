export type DeviceFamily = 'hecate' | 'rapoo';

export interface DeviceModelInfo {
  name: string;
  shortName: string;
  sensor: string;
  maxDpi: string;
  polling: string;
  connection: string;
  verified: boolean;
}

export const DEVICE_MODELS: Record<DeviceFamily, DeviceModelInfo> = {
  hecate: {
    name: 'HECATE G3M PRO',
    shortName: 'G3M PRO',
    sensor: 'PAW3395',
    maxDpi: '26,000 DPI',
    polling: '1,000 Hz',
    connection: '三模无线',
    verified: true,
  },
  rapoo: {
    name: 'Rapoo VT9PRO',
    shortName: 'VT9PRO',
    sensor: 'PAW3395',
    maxDpi: '26,000 DPI',
    polling: '1,000 Hz',
    connection: '2.4G / USB 有线',
    verified: false,
  },
};

export const DEFAULT_MODEL = DEVICE_MODELS.hecate;
