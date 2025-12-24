<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <system.webServer>

        <!-- URL Rewrite Rules -->
        <rewrite>
            <rules>

                <!-- Root Proxy -->
                <rule name="RootProxy" stopProcessing="true">
                    <match url="^$" />
                    <action type="Rewrite" url="http://localhost:3000/" />
                </rule>

                <!-- Health endpoint -->
                <rule name="Health" stopProcessing="true">
                    <match url="^health$" />
                    <action type="Rewrite" url="http://localhost:3000/health" />
                </rule>

                <!-- Info endpoint -->
                <rule name="Info" stopProcessing="true">
                    <match url="^info$" />
                    <action type="Rewrite" url="http://localhost:3000/info" />
                </rule>

                <!-- API Proxy endpoint -->
                <rule name="APIProxy" stopProcessing="true">
                    <match url="^api/proxy(.*)" />
                    <action type="Rewrite" url="http://localhost:3000/api/proxy{R:1}" appendQueryString="true" />
                </rule>

                <!-- WebSocket Proxy endpoint -->
                <rule name="WebSocketProxy" stopProcessing="true">
                    <match url="^api/ws-proxy(.*)" />
                    <action type="Rewrite" url="http://localhost:3000/api/ws-proxy{R:1}" appendQueryString="true" />
                </rule>

            </rules>
        </rewrite>

        <!-- Default Documents -->
        <defaultDocument enabled="true">
            <files>
                <clear />
                <add value="index.html" />
            </files>
        </defaultDocument>

        <!-- Static Content MIME Types -->
        <staticContent>
            <remove fileExtension=".json" />
            <mimeMap fileExtension=".json" mimeType="application/json" />
        </staticContent>

        <!-- CORS Headers - حذف شده چون Express CORS middleware این کار را می‌کند -->
        <!-- اگر CORS headers را اینجا اضافه کنیم، با Express CORS middleware تداخل می‌کند -->
        <httpProtocol>
            <customHeaders>
                <clear />
                <!-- فقط security headers را اینجا نگه می‌داریم -->
                <add name="X-Content-Type-Options" value="nosniff" />
                <add name="X-Frame-Options" value="SAMEORIGIN" />
                <add name="X-XSS-Protection" value="1; mode=block" />
                <add name="Referrer-Policy" value="strict-origin-when-cross-origin" />
            </customHeaders>
        </httpProtocol>

        <!-- Disable directory browsing -->
        <directoryBrowse enabled="false" />

        <!-- Application Request Routing (ARR) - فقط اگر ARR نصب است -->
        <!-- برای فعال کردن، این بخش را uncomment کنید و ARR را نصب کنید -->
        <!--
        <applicationRequestRouting>
            <proxy enabled="true" />
            <proxySettings>
                <timeout>00:04:00</timeout>
            </proxySettings>
        </applicationRequestRouting>
        -->

    </system.webServer>
</configuration>

