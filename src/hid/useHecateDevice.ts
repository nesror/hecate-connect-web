import { useCallback, useEffect, useRef, useState } from 'react';
import type { Binding, ButtonId } from '../types';
import {
  HecateHid,
  type HidDescriptor,
  type ProbeResult,
  type WriteResult,
} from './HecateHid';
import { REPORT_ID } from './protocol';

export type HidPhase =
  | 'unsupported'
  | 'idle'
  | 'requesting'
  | 'connecting'
  | 'connected'
  | 'error';

export interface HecateController {
  phase: HidPhase;
  busy: boolean;
  error: string | null;
  descriptor: HidDescriptor | null;
  probe: ProbeResult | null;
  reportId: number;
  setReportId: (value: number) => void;
  grantedCount: number;
  connect: () => Promise<void>;
  connectGranted: () => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
  writeBindings: (bindings: Record<ButtonId, Binding>) => Promise<WriteResult>;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name && error.name !== 'Error' && !error.message.startsWith(error.name)) {
      return `${error.name}: ${error.message}`;
    }
    return error.message;
  }
  return String(error);
}

export function useHecateDevice(): HecateController {
  const supported = typeof navigator !== 'undefined' && navigator.hid !== undefined;
  const [phase, setPhase] = useState<HidPhase>(supported ? 'idle' : 'unsupported');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [descriptor, setDescriptor] = useState<HidDescriptor | null>(null);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [reportId, setReportIdState] = useState(REPORT_ID);
  const [grantedCount, setGrantedCount] = useState(0);

  const hidRef = useRef<HecateHid | null>(null);
  const reportIdRef = useRef(REPORT_ID);

  const setReportId = useCallback((value: number) => {
    const next = Number.isFinite(value) ? Math.min(255, Math.max(0, Math.round(value))) : REPORT_ID;
    reportIdRef.current = next;
    setReportIdState(next);
  }, []);

  const openDevice = useCallback(async (device: HIDDevice) => {
    const previous = hidRef.current;
    if (previous && previous.device !== device) {
      await previous.close().catch(() => undefined);
    }

    setPhase('connecting');
    setError(null);
    setDescriptor(null);
    setProbe(null);

    const hid = new HecateHid(device, reportIdRef.current);
    try {
      await hid.open();
      hidRef.current = hid;
      setDescriptor(hid.descriptor);
      setBusy(true);
      try {
        const result = await hid.probe();
        setProbe(result);
        setPhase('connected');
      } finally {
        setBusy(false);
      }
    } catch (caught) {
      hidRef.current = hid.device.opened ? hid : null;
      setError(describeError(caught));
      setPhase('error');
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
      const devices = await navigator.hid.requestDevice({ filters: [] });
      if (devices.length === 0) {
        setPhase(hidRef.current ? 'connected' : 'idle');
        return;
      }
      await openDevice(devices[0]);
    } catch (caught) {
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
      const devices = await navigator.hid.getDevices();
      setGrantedCount(devices.length);
      if (devices.length === 0) {
        setError('没有已授权的 HID 设备，请点击“连接鼠标”重新选择。');
        setPhase('idle');
        return;
      }
      await openDevice(devices[0]);
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
    setProbe(null);
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
      const result = await hid.probe();
      setProbe(result);
      setPhase('connected');
    } catch (caught) {
      setError(describeError(caught));
      setPhase('error');
    } finally {
      setBusy(false);
    }
  }, []);

  const writeBindings = useCallback(async (bindings: Record<ButtonId, Binding>) => {
    const hid = hidRef.current;
    if (!hid) throw new Error('请先连接鼠标。');

    setBusy(true);
    setError(null);
    try {
      const result = await hid.writeBindings(bindings);
      if (result.verification) setProbe(result.verification);
      setPhase('connected');
      return result;
    } catch (caught) {
      setError(describeError(caught));
      throw caught;
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!navigator.hid) return;
    const hid = navigator.hid;

    const refreshGranted = () => {
      void hid
        .getDevices()
        .then((devices) => setGrantedCount(devices.length))
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
        setProbe(null);
        setBusy(false);
        setError('鼠标已断开。请重新连接 USB 数据线后再试。');
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
    descriptor,
    probe,
    reportId,
    setReportId,
    grantedCount,
    connect,
    connectGranted,
    disconnect,
    refresh,
    writeBindings,
  };
}
