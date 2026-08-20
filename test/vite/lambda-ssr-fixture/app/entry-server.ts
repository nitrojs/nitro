async function render(_request: Request) {
  return Response.json({
    ok: true,
  });
}

export { render as fetch };

export default render;
