const items: string[] = [];

export function registerItem(item: string) {
  items.push(item);
}

export function getItems() {
  return items;
}
