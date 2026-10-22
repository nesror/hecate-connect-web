import { RefreshCw, Usb, Zap } from 'lucide-react';
import { useState } from 'react';
import type { HecateController } from '../hid/useHecateDevice';
import type { WriteSections } from '../hid/HecateHid';
import type { Profile, ToastMessage } from '../types';
import { Modal } from './ui';

interface DeviceWriteButtonProps {
  device: HecateController;
  profile: Profile;
  sections: WriteSections;
  title: string;
  description: string;
  onOpenDevice: () => void;
  notify: (toast: Omit<ToastMessage, 'id'>) => void;
}

export function DeviceWriteButton({
  device,
  profile,
  sections,
  title,
  description,
  onOpenDevice,
  notify,
}: DeviceWriteButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [writing, setWriting] = useState(false);
  const connected = device.phase === 'connected';
  const busy = writing || device.busy;

  const handleOpen = () => {
    if (!connected) {
      notify({
        tone: 'info',
        title: '尚未连接鼠标',
        detail: '请先在设备面板中连接 G3M PRO，再写入硬件配置。',
      });
      onOpenDevice();
      return;
    }
    setConfirmOpen(true);
  };

  const handleWrite = async () => {
    if (!connected || busy) return;
    setWriting(true);
    try {
      const result = await device.writeProfile(profile, sections);
      const verified = result.verified === true;
      notify({
        tone: verified ? 'success' : 'info',
        title: verified ? '已写入鼠标并验证' : '写入流程结束',
        detail: verified
          ? `“${title}”已写入板载配置，设备回读值与目标一致。`
          : result.verified === false
            ? '写入命令完成，但回读值与目标不一致，请重新连接后核对。'
            : result.verificationError
              ? `写入命令完成，但回读验证失败：${result.verificationError}`
              : '写入命令已完成，但未能回读验证。',
      });
      setConfirmOpen(false);
    } catch (error) {
      notify({
        tone: 'error',
        title: '写入失败',
        detail: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setWriting(false);
    }
  };

  return (
    <>
      <button type="button" className="outline-button" disabled={busy} onClick={handleOpen}>
        {connected ? <Zap size={16} /> : <Usb size={16} />}
        {connected ? '写入鼠标' : '连接鼠标以写入'}
      </button>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`写入 ${title} 到鼠标？`}
        description={description}
        size="compact"
        footer={
          <>
            <button
              type="button"
              className="ghost-button"
              disabled={busy}
              onClick={() => setConfirmOpen(false)}
            >
              取消
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={busy}
              onClick={() => void handleWrite()}
            >
              {busy ? <RefreshCw size={15} className="is-spinning" /> : <Zap size={15} />}
              {busy ? '正在写入…' : '确认写入'}
            </button>
          </>
        }
      >
        <div className="inline-note">
          <Usb size={15} />
          写入期间请勿拔下鼠标。完成后会自动重新读取设备，核对配置块中的目标字节与回报率。
        </div>
      </Modal>
    </>
  );
}
