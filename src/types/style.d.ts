declare module '*.css' {
  const content: string | { readonly [className: string]: string }
  export default content
}
