// esbuild's binary loader turns .ttf imports into Uint8Array exports
declare module '*.ttf' {
  const data: Uint8Array
  export default data
}
