import type { DeviceSettings } from '../hid/profileCodec';
import type { MouseController } from '../hid/useMouseDevice';
import type { Binding, ButtonId, Profile, ToastMessage } from '../types';
import { DeviceConnectPanel } from './DeviceConnectPanel';
import { HecateDevicePanel } from './HecateDevicePanel';
import { RapooDevicePanel } from './RapooDevicePanel';

interface DeviceModalProps {
  open: boolean;
  onClose: () => void;
  device: MouseController;
  profile: Profile;
  onApplyBindings: (bindings: Record<ButtonId, Binding>) => void;
  onApplyDeviceSettings: (settings: DeviceSettings) => void;
  notify: (toast: Omit<ToastMessage, 'id'>) => void;
}

export function DeviceModal({
  open,
  onClose,
  device,
  profile,
  onApplyBindings,
  onApplyDeviceSettings,
  notify,
}: DeviceModalProps) {
  if (!device.family || device.phase === 'idle') {
    return <DeviceConnectPanel open={open} onClose={onClose} device={device} />;
  }

  if (device.family === 'rapoo') {
    return <RapooDevicePanel open={open} onClose={onClose} device={device} profile={profile} notify={notify} />;
  }

  return (
    <HecateDevicePanel
      open={open}
      onClose={onClose}
      device={device}
      profile={profile}
      onApplyBindings={onApplyBindings}
      onApplyDeviceSettings={onApplyDeviceSettings}
      notify={notify}
    />
  );
}
