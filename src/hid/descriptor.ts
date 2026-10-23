export interface HidCollectionSummary {
  usagePage: number;
  usage: number;
  type: number;
  inputReportIds: number[];
  outputReportIds: number[];
  featureReportIds: number[];
}

export interface HidDescriptor {
  vendorId: number;
  productId: number;
  productName: string;
  manufacturerName: string;
  serialNumber: string;
  collections: HidCollectionSummary[];
  inputReportIds: number[];
  outputReportIds: number[];
  featureReportIds: number[];
}

function flattenCollections(
  source: readonly HIDCollectionInfo[],
  target: HIDCollectionInfo[] = [],
): HIDCollectionInfo[] {
  for (const collection of source) {
    target.push(collection);
    if (collection.children?.length) flattenCollections(collection.children, target);
  }
  return target;
}

function collectReportIds(
  collections: HIDCollectionInfo[],
  key: 'inputReports' | 'outputReports' | 'featureReports',
): number[] {
  const ids = new Set<number>();
  for (const collection of collections) {
    for (const report of collection[key] ?? []) ids.add(report.reportId);
  }
  return [...ids].sort((left, right) => left - right);
}

export function describeHidDevice(device: HIDDevice): HidDescriptor {
  const collections = flattenCollections(device.collections ?? []);
  return {
    vendorId: device.vendorId,
    productId: device.productId,
    productName: device.productName,
    manufacturerName: device.manufacturerName,
    serialNumber: device.serialNumber,
    collections: collections.map((collection) => ({
      usagePage: collection.usagePage,
      usage: collection.usage,
      type: collection.type,
      inputReportIds: (collection.inputReports ?? []).map((report) => report.reportId),
      outputReportIds: (collection.outputReports ?? []).map((report) => report.reportId),
      featureReportIds: (collection.featureReports ?? []).map((report) => report.reportId),
    })),
    inputReportIds: collectReportIds(collections, 'inputReports'),
    outputReportIds: collectReportIds(collections, 'outputReports'),
    featureReportIds: collectReportIds(collections, 'featureReports'),
  };
}

export function hasVendorCollection(
  device: HIDDevice,
  usagePage: number,
  usages: readonly number[],
): boolean {
  return flattenCollections(device.collections ?? []).some(
    (collection) =>
      collection.usagePage === usagePage && usages.includes(collection.usage),
  );
}
