import { RefreshCw, Usb, Zap } from 'lucide-react';
import { useState } from 'react';
import type { WriteSections } from '../hid/HecateHid';
import type { MouseController } from '../hid/useMouseDevice';
import type { Profile, ToastMessage } from '../types';
import { Modal } from './ui';

interface DeviceWriteButtonProps {
  device: MouseController;
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
  const rapoo = device.family === 'rapoo';

  const handleOpen = () => {
    if (!connected) {
      notify({
        tone: 'info',
        title: '尚未连接鼠标',
        detail: '请先在设备面板中连接 HECATE G3M PRO 或 Rapoo VT9PRO，再写入或发送硬件配置。',
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

      if (result.family === 'rapoo') {
        const skipped = result.rapoo.buttons.filter((item) => !item.written).length;
        notify({
          tone: 'info',
          title: result.frames > 0 ? '配置已发送（未验证）' : '没有可发送的项',
          detail:
            result.frames > 0
              ? `已向 Rapoo 设备发送 ${result.frames} 个配置帧；浏览器无法回读确认是否生效。${
                  skipped > 0 ? ` ${skipped} 个按键保留设备原值。` : ''
                }`
              : result.warnings[0] ?? '当前设置没有可通过 Rapoo 协议发送的项。',
        });
        setConfirmOpen(false);
        return;
      }

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
        {connected ? (rapoo ? '发送到设备' : '写入鼠标') : '连接鼠标以写入'}
      </button>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`${rapoo ? '发送' : '写入'} ${title} 到鼠标？`}
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
              {busy ? (rapoo ? '正在发送…' : '正在写入…') : rapoo ? '确认发送' : '确认写入'}
            </button>
          </>
        }
      >
        <div className={rapoo ? 'inline-note is-warning' : 'inline-note'}>
          <Usb size={15} />
          {rapoo
            ? '发送期间请勿断开 Rapoo 接收器或 USB 数据线。设备不支持配置回读，完成后无法在浏览器中验证是否生效。'
            : '写入期间请勿拔下鼠标。完成后会自动重新读取设备，核对配置块中的目标字节与回报率。'}
        </div>
      </Modal>
    </>
  );
}
