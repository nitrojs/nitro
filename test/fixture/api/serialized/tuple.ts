export default defineHandler(() => {
  return ["foo", new Date()] as [string, Date];
});
