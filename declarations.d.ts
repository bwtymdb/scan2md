declare module "qrcode-generator" {
  interface QRCode {
    addData(data: string, mode?: string): void;
    make(): void;
    getModuleCount(): number;
    isDark(row: number, col: number): boolean;
    createDataURL(cellSize: number, margin: number): string;
    createImgTag(cellSize: number, margin: number, alt?: string): string;
    createSvgTag(opts?: {
      cellSize?: number;
      margin?: number;
      scalable?: boolean;
      alt?: string;
      title?: string;
    }): string;
    createASCII(cellSize: number, margin: number, reverse?: boolean): string;
  }
  function qrcode(
    typeNumber: number,
    errorCorrectionLevel: "L" | "M" | "Q" | "H"
  ): QRCode;
  export default qrcode;
}
