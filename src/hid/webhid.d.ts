interface HIDReportInfo {
  readonly reportId: number;
  readonly items: readonly unknown[];
}

interface HIDCollectionInfo {
  readonly usagePage: number;
  readonly usage: number;
  readonly type: number;
  readonly children: readonly HIDCollectionInfo[];
  readonly inputReports: readonly HIDReportInfo[];
  readonly outputReports: readonly HIDReportInfo[];
  readonly featureReports: readonly HIDReportInfo[];
}

interface HIDDevice extends EventTarget {
  readonly opened: boolean;
  readonly vendorId: number;
  readonly productId: number;
  readonly productName: string;
  readonly manufacturerName: string;
  readonly serialNumber: string;
  readonly collections: readonly HIDCollectionInfo[];
  oninputreport: ((this: HIDDevice, event: HIDInputReportEvent) => void) | null;
  open(): Promise<void>;
  close(): Promise<void>;
  sendReport(reportId: number, data: BufferSource): Promise<void>;
  sendFeatureReport(reportId: number, data: BufferSource): Promise<void>;
  receiveFeatureReport(reportId: number): Promise<DataView>;
}

interface HIDInputReportEvent extends Event {
  readonly device: HIDDevice;
  readonly reportId: number;
  readonly data: DataView;
}

interface HIDConnectionEvent extends Event {
  readonly device: HIDDevice;
}

interface HIDDeviceFilter {
  vendorId?: number;
  productId?: number;
  usagePage?: number;
  usage?: number;
}

interface HID extends EventTarget {
  onconnect: ((this: HID, event: HIDConnectionEvent) => void) | null;
  ondisconnect: ((this: HID, event: HIDConnectionEvent) => void) | null;
  getDevices(): Promise<HIDDevice[]>;
  requestDevice(options?: {
    filters?: HIDDeviceFilter[];
    exclusionFilters?: HIDDeviceFilter[];
  }): Promise<HIDDevice[]>;
}

interface Navigator {
  readonly hid?: HID;
}
