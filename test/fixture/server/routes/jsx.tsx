const h = (tag: string, props: any, ...children: any[]) => {
  return `<${tag} ${Object.keys(props || {})
    .map((key) => `${key}="${props[key]}"`)
    .join(" ")
    .trim()}>${children.join("")}</${tag}>`;
};

export default defineHandler(() => {
  return <h1>Hello JSX!</h1>;
});
