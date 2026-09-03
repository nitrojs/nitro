export default (event: any) => "root-wildcard:" + (event.context.params?.path ?? "");
