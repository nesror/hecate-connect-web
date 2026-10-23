import { useCallback, useEffect, useRef, useState } from 'react';
import type { Profile } from '../types';
import { DEFAULT_MODEL, DEVICE_MODELS, type DeviceFamily, type DeviceModelInfo } from './deviceModels';
import {
  HecateHid,
  type HidDescriptor,
  type ProbeResult,
  type WriteResult,
  type WriteSections,
} from './HecateHid';
import { hasVendorCollection } from './descriptor';
import { HECATE_VENDOR_ID, REPORT_ID } from './protocol';
import {
  RAPOO_PRODUCT_ID,
  RAPOO_USAGE,
  RAPOO_USAGE_PAGE,
  RAPOO_VENDOR_ID,
  RAPOO_WIRED_PRODUCT_ID,
} from './rapooProtocol';
import { RapooHid, type RapooProbe, type RapooWriteResult } from './RapooHid';

export type { DeviceFamily, DeviceModelInfo } from './deviceModels';

export type HidPhase =
  | 'unsupported'
  | 'idle'
  | 'requesting'
  | 'connecting'
  | 'connected'
  | 'error';

export interface HecateWriteOutcome {
  family: 'hecate';
  verified: boolean | null;
  verificationError: string | null;
  warnings: string[];
  frames: number;
  hecate: WriteResult;
}

export interface RapooWriteOutcome {
  family: 'rapoo';
  verified: null;
  verificationError: null;
  warnings: string[];
  frames: number;
  rapoo: RapooWriteResult;
}

export type WriteOutcome = HecateWriteOutcome | RapooWriteOutcome;

export interface MouseController {
  phase: HidPhase;
  busy: boolean;
  error: string | null;
  family: DeviceFamily | null;
  model: DeviceModelInfo;
  descriptor: HidDescriptor | null;
  probe: ProbeResult | null;
  rapooProbe: RapooProbe | null;
  rapooWired: boolean;
  reportId: number;
  setReportId: (value: number) => void;
  grantedCount: number;
  connect: () => Promise<void>;
  connectGranted: () => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
  writeProfile: (profile: Profile, sections?: WriteSections) => Promise<WriteOutcome>;
}

type MouseHid = HecateHid | RapooHid;

function describeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name && error.name !== 'Error' && !error.message.startsWith(error.name)) {
      return `${error.name}: ${error.message}`;
    }
    return error.message;
  }
  return String(error);
}

export function detectFamily(device: HIDDevice): DeviceFamily | null {
  if (
    device.vendorId === RAPOO_VENDOR_ID &&
    (device.productId === RAPOO_PRODUCT_ID ||
      device.productId === RAPOO_WIRED_PRODUCT_ID ||
      hasVendorCollection(device, RAPOO_USAGE_PAGE, [RAPOO_USAGE]))
  ) {
    return 'rapoo';
  }
  if (device.vendorId === HECATE_VENDOR_ID) return 'hecate';
  return null;
}

const REQUEST_FILTERS: HIDDeviceFilter[] = [
  { vendorId: HECATE_VENDOR_ID },
  { vendorId: RAPOO_VENDOR_ID, usagePage: RAPOO_USAGE_PAGE, usage: RAPOO_USAGE },
];

export function useMouseDevice(): MouseController {
  const supported = typeof navigator !== 'undefined' && navigator.hid !== undefined;
  const [phase, setPhase] = useState<HidPhase>(supported ? 'idle' : 'unsupported');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [family, setFamily] = useState<DeviceFamily | null>(null);
  const [descriptor, setDescriptor] = useState<HidDescriptor | null>(null);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [rapooProbe, setRapooProbe] = useState<RapooProbe | null>(null);
  const [rapooWired, setRapooWired] = useState(false);
  const [reportId, setReportIdState] = useState(REPORT_ID);
  const [grantedCount, setGrantedCount] = useState(0);

  const hidRef = useRef<MouseHid | null>(null);
  const reportIdRef = useRef(REPORT_ID);
  const familyRef = useRef<DeviceFamily | null>(null);

  const setReportId = useCallback((value: number) => {
    const next = Number.isFinite(value) ? Math.min(255, Math.max(0, Math.round(value))) : REPORT_ID;
    reportIdRef.current = next;
    setReportIdState(next);
  }, []);

  const resetProbe = () => {
    setProbe(null);
    setRapooProbe(null);
  };

  const openDevice = useCallback(async (device: HIDDevice) => {
    const nextFamily = detectFamily(device);
    if (!nextFamily) {
      setError(
        '所选设备不是已支持的鼠标。请选择 HECATE G3M PRO，或连接 Rapoo VT9PRO 的 2.4G 接收器 / USB 数据线后重试。',
      );
      setPhase('error');
      return;
    }

    const previous = hidRef.current;
    if (previous && previous.device !== device) {
      await previous.close().catch(() => undefined);
    }

    familyRef.current = nextFamily;
    setFamily(nextFamily);
    setRapooWired(nextFamily === 'rapoo' && device.productId === RAPOO_WIRED_PRODUCT_ID);
    setPhase('connecting');
    setError(null);
    setDescriptor(null);
    resetProbe();
    setBusy(true);

    const hid = nextFamily === 'hecate' ? new HecateHid(device, reportIdRef.current) : new RapooHid(device);

    try {
      if (hid instanceof HecateHid) {
        await hid.open();
        hidRef.current = hid;
        setDescriptor(hid.descriptor);
        const result = await hid.probe();
        setProbe(result);
      } else {
        const session = await hid.open();
        hidRef.current = hid;
        setDescriptor(hid.descriptor);
        setRapooProbe({
          reportId: session.reportId,
          probeFrames: session.probeFrames,
          probedAt: session.openedAt,
        });
      }
      setPhase('connected');
    } catch (caught) {
      hidRef.current = device.opened ? hid : null;
      setError(describeError(caught));
      setPhase('error');
    } finally {
      setBusy(false);
    }
  }, []);

  const connect = useCallback(async () => {
    if (!navigator.hid) {
      setPhase('unsupported');
      return;
    }

    setError(null);
    setPhase('requesting');
    try {
      const devices = await navigator.hid.requestDevice({ filters: REQUEST_FILTERS });
      if (devices.length === 0) {
        setPhase(hidRef.current ? 'connected' : 'idle');
        return;
      }
      await openDevice(devices[0]);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'NotFoundError') {
        setPhase(hidRef.current ? 'connected' : 'idle');
        return;
      }
      setError(describeError(caught));
      setPhase(hidRef.current ? 'connected' : 'error');
    }
  }, [openDevice]);

  const connectGranted = useCallback(async () => {
    if (!navigator.hid) {
      setPhase('unsupported');
      return;
    }

    setError(null);
    try {
      const devices = (await navigator.hid.getDevices()).filter(
        (device) => detectFamily(device) !== null,
      );
      setGrantedCount(devices.length);
      if (devices.length === 0) {
        setError('没有已授权的 HECATE 或 Rapoo 设备，请点击“连接设备”重新选择。');
        setPhase('idle');
        return;
      }
      const preferred =
        devices.find((device) => detectFamily(device) === familyRef.current) ?? devices[0];
      await openDevice(preferred);
    } catch (caught) {
      setError(describeError(caught));
      setPhase('error');
    }
  }, [openDevice]);

  const disconnect = useCallback(async () => {
    const hid = hidRef.current;
    hidRef.current = null;
    setBusy(false);
    setDescriptor(null);
    resetProbe();
    setRapooWired(false);
    setError(null);
    setPhase(supported ? 'idle' : 'unsupported');
    if (hid) await hid.close().catch(() => undefined);
  }, [supported]);

  const refresh = useCallback(async () => {
    const hid = hidRef.current;
    if (!hid) {
      setError('设备尚未连接。');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (hid instanceof HecateHid) {
        const result = await hid.probe();
        setProbe(result);
      } else {
        const result = await hid.probe();
        setRapooProbe(result);
      }
      setPhase('connected');
    } catch (caught) {
      setError(describeError(caught));
      setPhase('error');
    } finally {
      setBusy(false);
    }
  }, []);

  const writeProfile = useCallback(
    async (profile: Profile, sections?: WriteSections): Promise<WriteOutcome> => {
      const hid = hidRef.current;
      if (!hid) throw new Error('请先连接鼠标。');

      setBusy(true);
      setError(null);
      try {
        if (hid instanceof HecateHid) {
          const result = await hid.writeProfile(profile, sections);
          if (result.verification) setProbe(result.verification);
          setPhase('connected');
          return {
            family: 'hecate',
            verified: result.verified,
            verificationError: result.verificationError,
            warnings: result.warnings,
            frames: result.traces.length + 1,
            hecate: result,
          };
        }

        const result = await hid.writeProfile(profile, sections);
        setPhase('connected');
        return {
          family: 'rapoo',
          verified: null,
          verificationError: null,
          warnings: result.warnings,
          frames: result.frames,
          rapoo: result,
        };
      } catch (caught) {
        setError(describeError(caught));
        throw caught;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!navigator.hid) return;
    const hid = navigator.hid;

    const refreshGranted = () => {
      void hid
        .getDevices()
        .then((devices) =>
          setGrantedCount(devices.filter((device) => detectFamily(device) !== null).length),
        )
        .catch(() => undefined);
    };
    refreshGranted();

    hid.onconnect = () => refreshGranted();
    hid.ondisconnect = (event) => {
      refreshGranted();
      const current = hidRef.current;
      if (current && event.device === current.device) {
        hidRef.current = null;
        setDescriptor(null);
        resetProbe();
        setBusy(false);
        setRapooWired(false);
        setError(
          familyRef.current === 'rapoo'
            ? 'Rapoo 设备已断开。请重新插入 2.4G 接收器或连接 USB 数据线后再试。'
            : '鼠标已断开。请重新连接 USB 数据线后再试。',
        );
        setPhase('error');
      }
    };

    return () => {
      hid.onconnect = null;
      hid.ondisconnect = null;
      const current = hidRef.current;
      hidRef.current = null;
      if (current) void current.close();
    };
  }, []);

  return {
    phase,
    busy,
    error,
    family,
    model: family ? DEVICE_MODELS[family] : DEFAULT_MODEL,
    descriptor,
    probe,
    rapooProbe,
    rapooWired,
    reportId,
    setReportId,
    grantedCount,
    connect,
    connectGranted,
    disconnect,
    refresh,
    writeProfile,
  };
}
