import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { defu } from "defu";
import { writeFile } from "../_utils/fs.ts";
import type { Nitro } from "nitro/types";
import { resolve } from "pathe";

export async function writeIISFiles(nitro: Nitro) {
  await writeFile(resolve(nitro.options.output.dir, "web.config"), await iisXmlTemplate(nitro));
}

export async function writeIISNodeFiles(nitro: Nitro) {
  await writeFile(resolve(nitro.options.output.dir, "web.config"), await iisnodeXmlTemplate(nitro));

  await writeFile(
    resolve(nitro.options.output.dir, "index.js"),
    /*js */ `
    if (process.env.PORT.startsWith('\\\\')) {
      process.env.NITRO_UNIX_SOCKET = process.env.PORT
      delete process.env.PORT
    }
    import('./server/index.mjs');
    `
  );
}

async function iisnodeXmlTemplate(nitro: Nitro) {
  const path = resolve(nitro.options.rootDir, "web.config");
  const originalString = /* xml */ `<?xml version="1.0" encoding="utf-8"?>
  <!--
       This configuration file is required if iisnode is used to run node processes behind
       IIS or IIS Express.  For more information, visit:
       https://github.com/Azure/iisnode/blob/master/src/samples/configuration/web.config
  -->
  <configuration>
    <system.webServer>
      <!-- Visit http://blogs.msdn.com/b/windowsazure/archive/2013/11/14/introduction-to-websockets-on-windows-azure-web-sites.aspx for more information on WebSocket support -->
      <webSocket enabled="false" />
      <handlers>
        <!-- Indicates that the index.js file is a Node.js site to be handled by the iisnode module -->
        <add name="iisnode" path="index.js" verb="*" modules="iisnode" />
      </handlers>
      <rewrite>
        <rules>
          <!-- Do not interfere with requests for node-inspector debugging -->
          <rule name="NodeInspector" patternSyntax="ECMAScript" stopProcessing="true">
            <match url="^index.js/debug[/]?" />
          </rule>

          <!-- First we consider whether the incoming URL matches a physical file in the /public folder -->
          <rule name="StaticContent">
            <action type="Rewrite" url="public{PATH_INFO}" />
          </rule>

          <!-- All other URLs are mapped to the Node.js site entrypoint -->
          <rule name="DynamicContent">
            <conditions>
              <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="True" />
            </conditions>
            <action type="Rewrite" url="index.js" />
          </rule>
        </rules>
      </rewrite>

      <!-- 'bin' directory has no special meaning in Node.js and apps can be placed in it -->
      <security>
        <requestFiltering>
          <hiddenSegments>
            <remove segment="bin" />
          </hiddenSegments>
          <requestLimits maxAllowedContentLength="4294967295" />
        </requestFiltering>
      </security>

      <!-- Make sure error responses are left untouched -->
      <httpErrors existingResponse="PassThrough" />

      <!--
        You can control how Node is hosted within IIS using the following options:
          * watchedFiles: semi-colon separated list of files that will be watched for changes to restart the server
          * node_env: will be propagated to node as NODE_ENV environment variable
          * debuggingEnabled - controls whether the built-in debugger is enabled
        See https://github.com/Azure/iisnode/blob/master/src/samples/configuration/web.config for a full list of options
      -->
      <iisnode
        watchedFiles="index.js"
        node_env="production"
        debuggingEnabled="false"
        loggingEnabled="false"
      />
    </system.webServer>
  </configuration>
`;
  if (existsSync(path)) {
    const fileString = await readFile(path, "utf8");
    const originalWebConfig: Record<string, unknown> = await parseXmlDoc(originalString);
    const fileWebConfig: Record<string, unknown> = await parseXmlDoc(fileString);

    if (nitro.options.iis?.mergeConfig && !nitro.options.iis.overrideConfig) {
      return buildNewXmlDoc(defu(fileWebConfig, originalWebConfig));
    }
    if (nitro.options.iis?.overrideConfig) {
      return buildNewXmlDoc({ ...fileWebConfig });
    }
  }
  return originalString;
}

async function iisXmlTemplate(nitro: Nitro) {
  const path = resolve(nitro.options.rootDir, "web.config");
  const originalString = /* xml */ `<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <handlers>
      <add name="httpPlatformHandler" path="*" verb="*" modules="httpPlatformHandler" resourceType="Unspecified" requireAccess="Script" />
    </handlers>
    <httpPlatform stdoutLogEnabled="true" stdoutLogFile=".\\logs\\node.log" startupTimeLimit="20" processPath="C:\\Program Files\\nodejs\\node.exe" arguments=".\\server\\index.mjs">
      <environmentVariables>
        <environmentVariable name="PORT" value="%HTTP_PLATFORM_PORT%" />
        <environmentVariable name="NODE_ENV" value="Production" />
      </environmentVariables>
    </httpPlatform>
  </system.webServer>
</configuration>
`;
  if (existsSync(path)) {
    const fileString = await readFile(path, "utf8");
    const originalWebConfig: Record<string, unknown> = await parseXmlDoc(originalString);
    const fileWebConfig: Record<string, unknown> = await parseXmlDoc(fileString);

    if (nitro.options.iis?.mergeConfig && !nitro.options.iis.overrideConfig) {
      return buildNewXmlDoc(defu(fileWebConfig, originalWebConfig));
    }
    if (nitro.options.iis?.overrideConfig) {
      return buildNewXmlDoc({ ...fileWebConfig });
    }
  }
  return originalString;
}

//  XML Helpers
async function parseXmlDoc(xml: string): Promise<Record<string, unknown>> {
  const { Parser } = await import("xml2js");

  if (xml === undefined || !xml) {
    return {};
  }
  const parser = new Parser({ explicitArray: false });
  let parsedRecord: Record<string, unknown> = {};
  parser.parseString(xml, (_, r) => {
    parsedRecord = r;
  });
  return parsedRecord;
}

async function buildNewXmlDoc(xmlObj: Record<string, unknown>): Promise<string> {
  const { Builder } = await import("xml2js");
  const builder = new Builder();
  return builder.buildObject({ ...xmlObj });
}
