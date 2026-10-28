import { SITE_CODES } from '../centerAnalysis/site.mjs';
import { AnalysisError } from '../centerAnalysis/contracts.mjs';

const ANALYSIS_SCHEMA_VERSION = 'center-analysis.v1';
const READ_ONLY_ANNOTATIONS = Object.freeze({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
const MCP_SCOPE = 'openid';
const TOOL_SECURITY_SCHEMES = Object.freeze([Object.freeze({ type: 'oauth2', scopes: Object.freeze([MCP_SCOPE]) })]);
const MCP_INSTRUCTIONS = '센터를 지정한 요청에서는 모든 분석 도구와 프로그램 목록에 같은 site 필터를 적용하세요. 하이픈=HAIFN, 이높플레이스=ENOUGH_PLACE, 전체=ALL(생략 기본값)입니다. scope와 미분류 기록 제한을 확인하고 다른 센터의 방문을 재방문으로 계산하지 마세요. 센터 기록 기반의 집계 결과만 제공합니다. 개인별 기록·연락처·자유서술 응답은 요청하거나 반환하지 마세요. 결과의 기간, 분모, 품질 제한을 함께 설명하세요. operating_context의 실시 여부와 근거를 먼저 확인하세요. 응답 0건만으로 조사 미실시, 수집 장애, 운영 실패를 단정하지 마세요. 만족도와 체크인 설문은 별개입니다. coverage_unknown은 원천 데이터가 없다는 뜻이 아니라 기록 완전성이 검증되지 않았다는 뜻입니다. 빈 프로그램 카탈로그는 분석용 목록 미등록이며 프로그램 부재나 조회 장애라고 단정하지 마세요. 평균 방문 횟수만으로 기존 이용자 재방문 증가를 주장하지 마세요.';

const isHttpsUrl = value => {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash;
    } catch { return false; }
};

const strictObject = shape => schema => schema.object(shape).strict();

function requireDependencies({ Server, WebStandardStreamableHTTPServerTransport, ListToolsRequestSchema, CallToolRequestSchema, toJsonSchemaCompat, z, runOperation, authorize, resource, issuer }) {
    if (typeof Server !== 'function' || typeof WebStandardStreamableHTTPServerTransport !== 'function'
        || !ListToolsRequestSchema || !CallToolRequestSchema || typeof toJsonSchemaCompat !== 'function'
        || !z || typeof z.object !== 'function' || typeof runOperation !== 'function' || typeof authorize !== 'function'
        || !isHttpsUrl(resource) || !isHttpsUrl(issuer)) {
        throw new AnalysisError('not_configured');
    }
}

export function protectedResourceMetadata({ resource, issuer, documentation = null } = {}) {
    if (!isHttpsUrl(resource) || !isHttpsUrl(issuer) || documentation !== null && !isHttpsUrl(documentation)) {
        throw new AnalysisError('not_configured');
    }
    return Object.freeze({
        resource,
        authorization_servers: Object.freeze([issuer]),
        scopes_supported: Object.freeze([MCP_SCOPE]),
        ...(documentation ? { resource_documentation: documentation } : {}),
    });
}

export function protectedResourceMetadataUrl(resource) {
    if (!isHttpsUrl(resource)) throw new AnalysisError('not_configured');
    return `${resource}/.well-known/oauth-protected-resource`;
}

export function mcpAuthenticationChallenge(resource, { error = null, description = null } = {}) {
    const pieces = [`Bearer resource_metadata="${protectedResourceMetadataUrl(resource)}"`, `scope="${MCP_SCOPE}"`];
    if (error) pieces.push(`error="${error}"`);
    if (description) pieces.push(`error_description="${description.replace(/["\\]/g, '')}"`);
    return pieces.join(', ');
}

export function mcpUnauthorizedResponse(resource) {
    return Response.json({ error: 'unauthenticated' }, {
        status: 401,
        headers: {
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'WWW-Authenticate': mcpAuthenticationChallenge(resource, { error: 'invalid_token', description: 'A current center integration token is required.' }),
        },
    });
}

function periodSchema(z) {
    return strictObject({
        start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        end_exclusive: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })(z);
}

function inputSchemas(z) {
    const period = periodSchema(z);
    const site = z.enum(SITE_CODES).optional();
    const comparison = strictObject({
        kind: z.enum(['previous_equal_length', 'previous_calendar_period']),
        unit: z.enum(['week', 'month']).optional(),
    })(z);
    const programRefs = z.array(z.string().regex(/^[A-Za-z0-9._:-]+$/)).min(1).max(20);
    return Object.freeze({
        get_analysis_capabilities: strictObject({})(z),
        get_operation_summary: strictObject({
            site,
            period,
            comparison: comparison.optional(),
            domains: z.array(z.enum(['visits', 'duration', 'programs', 'feedback', 'rentals', 'store', 'surveys'])).min(1).max(7).optional(),
        })(z),
        get_program_catalog: strictObject({
            site,
            query: z.string().max(100).nullable().optional(),
            period: period.nullable().optional(),
            limit: z.number().int().min(1).max(20).optional(),
        })(z),
        analyze_program_engagement: strictObject({
            site,
            period,
            comparison: comparison.optional(),
            program_refs: programRefs.nullable().optional(),
            breakdown: z.enum(['none', 'program']),
            measures: z.array(z.enum(['applications', 'recorded_attendance', 'satisfaction', 'participation_distribution', 'transitions'])).min(1).max(5).optional(),
        })(z),
        analyze_revisits: strictObject({
            site,
            period,
            cohort: z.enum(['visitors', 'program_attendees']),
            program_refs: programRefs.nullable().optional(),
            followup_days: z.union([z.literal(7), z.literal(14), z.literal(30)]),
        })(z),
        analyze_program_visit_change: strictObject({
            site,
            period,
            program_refs: programRefs,
            window_days: z.union([z.literal(7), z.literal(14), z.literal(28), z.literal(30)]),
            measures: z.array(z.enum(['visitor_days', 'visit_sessions', 'measured_duration'])).min(1).max(3).optional(),
        })(z),
        get_metric_definitions: strictObject({
            metric_ids: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)).min(1).max(30).nullable().optional(),
        })(z),
    });
}

function outputSchema(z) {
    // The core validates every operation-specific field itself.  This outer
    // schema lets MCP clients recognize structured output without duplicating
    // seven large schemas in a transport layer.
    return z.object({ schema_version: z.literal(ANALYSIS_SCHEMA_VERSION) }).passthrough();
}

const toolDefinitions = Object.freeze([
    ['get_analysis_capabilities', '분석 가능 범위', '센터 기록의 사용 가능 범위와 고정 분석 도구를 확인할 때 사용합니다. 개인별 기록은 반환하지 않습니다.'],
    ['get_operation_summary', '운영 요약', '방문, 체류, 프로그램, 만족도, 대여, 스토어, 설문의 기간별 집계를 비교할 때 사용합니다. site로 하이픈(HAIFN) 또는 이높플레이스(ENOUGH_PLACE)를 선택합니다. 장소 미분류는 제외하며 스토어의 센터별 집계는 제공하지 않습니다.'],
    ['get_program_catalog', '승인된 프로그램 목록', '센터가 승인해 둔 프로그램 정보만 찾아볼 때 사용합니다.'],
    ['analyze_program_engagement', '프로그램 참여 분석', '신청 현재 상태, 기록상 출석, 숫자 만족도, 재참여 분포와 프로그램 이동을 비교할 때 사용합니다.'],
    ['analyze_revisits', '재방문 분석', '방문자 또는 프로그램 참여 집단의 7·14·30일 재방문을 분석합니다. 확정 재방문율과 recorded 기록 기준 비율을 구분하고, 프로그램 출석 없는 날의 재방문도 함께 확인합니다. 기존 기록으로 교사 연락 여부나 자발성을 확정할 수 없습니다.'],
    ['analyze_program_visit_change', '프로그램 전후 방문 변화', '기록상 프로그램 참여 전후 같은 기간의 방문일·세션·실측 체류 변화를 설명적으로 비교할 때 사용합니다. 인과효과를 확정하지 않습니다.'],
    ['get_metric_definitions', '지표 정의', '분석 결과의 포함·제외·분모·한계를 확인할 때 사용합니다.'],
]);

function toolResult(result) {
    const text = JSON.stringify(result);
    return Object.freeze({
        content: Object.freeze([{ type: 'text', text }]),
        structuredContent: result,
        // Unavailable data is a valid, explicit analytic answer.  Only a
        // malformed request or execution error is an MCP tool error.
        ...(result.status === 'error' ? { isError: true } : {}),
    });
}

function invalidToolInputResult() {
    return Object.freeze({
        content: Object.freeze([{ type: 'text', text: 'invalid_input' }]),
        isError: true,
    });
}

function unknownToolResult() {
    return Object.freeze({
        content: Object.freeze([{ type: 'text', text: 'unknown_tool' }]),
        isError: true,
    });
}

// ChatGPT discovers OAuth from a per-tool security scheme, then requests the
// sign-in flow from a tool result.  Do not return source-data errors here: an
// unauthenticated request has not been authorized to execute an analysis.
function authenticationRequiredToolResult(resource) {
    return Object.freeze({
        content: Object.freeze([{ type: 'text', text: 'authentication_required' }]),
        isError: true,
        _meta: Object.freeze({ 'mcp/www_authenticate': Object.freeze([mcpAuthenticationChallenge(resource)]) }),
    });
}

function listedTools(schemas, output, toJsonSchemaCompat) {
    const inputSchema = schema => toJsonSchemaCompat(schema, { strictUnions: true, pipeStrategy: 'input' });
    const outputSchema = toJsonSchemaCompat(output, { strictUnions: true, pipeStrategy: 'output' });
    // SDK 1.32 validates incoming messages but its current ToolSchema omits
    // the ChatGPT-required top-level `securitySchemes` extension.  The
    // low-level Server sends this fixed descriptor unchanged on the wire;
    // `_meta.securitySchemes` is retained only for older MCP clients.
    return Object.freeze(toolDefinitions.map(([name, title, description]) => Object.freeze({
        name,
        title,
        description,
        inputSchema: inputSchema(schemas[name]),
        outputSchema,
        annotations: READ_ONLY_ANNOTATIONS,
        securitySchemes: TOOL_SECURITY_SCHEMES,
        _meta: Object.freeze({ securitySchemes: TOOL_SECURITY_SCHEMES }),
    })));
}

function internalErrorResponse() {
    return Response.json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null }, {
        status: 500,
        headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
}

function unavailableResponse() {
    return Response.json({ error: 'temporarily_unavailable' }, {
        status: 503,
        headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Retry-After': '5' },
    });
}

// The SDK transport is stateless and a new server is constructed for each
// request.  That prevents one request's actor or tool result from remaining in
// an isolate-global session and makes every tool path perform authorization.
export function createCenterMcpRequestHandler(dependencies) {
    requireDependencies(dependencies);
    const {
        Server,
        WebStandardStreamableHTTPServerTransport,
        ListToolsRequestSchema,
        CallToolRequestSchema,
        toJsonSchemaCompat,
        z,
        runOperation,
        authorize,
        resource,
    } = dependencies;
    const schemas = inputSchemas(z);
    const output = outputSchema(z);
    const tools = listedTools(schemas, output, toJsonSchemaCompat);
    return async request => {
        // OAuth clients probe the endpoint with GET before protocol discovery.
        // Advertise the same metadata URL used by tool-level challenges.
        if (request.method === 'GET' && !request.headers.get('Authorization')) {
            return Response.json({ error: 'unauthenticated' }, {
                status: 401,
                headers: { 'Cache-Control': 'no-store', 'WWW-Authenticate': `Bearer resource_metadata="${resource}/.well-known/oauth-protected-resource", scope="openid"` },
            });
        }
        let actor;
        try { actor = await authorize(request.headers.get('Authorization')); }
        catch { return unavailableResponse(); }
        try {
            // Use the official protocol server directly because the current
            // high-level helper strips the standardized `securitySchemes`
            // field before `tools/list` reaches ChatGPT.  The HTTP transport,
            // initialization lifecycle, JSON-RPC validation, and tool-result
            // validation remain provided by the official SDK.
            const server = new Server({
                name: 'center-operations',
                version: '1.0.0',
            }, {
                capabilities: { tools: { listChanged: false } },
                instructions: `${MCP_INSTRUCTIONS} 재방문 분석에서 확정 지표가 unavailable이어도 recorded 지표가 있으면 기록 기준 결과와 한계를 설명하세요. suggested_mature_period가 반환되면 프로그램 목록을 그 기간으로 다시 조회하고 추적 완료 대상 분석을 이어가세요. observation_pending을 재방문 실패나 데이터 누락으로 해석하지 마세요. 프로그램 출석 없는 날의 재방문을 교사 연락 없는 자발적 방문으로 단정하지 마세요. 자발성은 self_reported_unprompted 지표와 initiative_respondents를 함께 확인하고 미응답 및 자기보고 한계를 밝히세요.`,
            });
            server.setRequestHandler(ListToolsRequestSchema, () => ({ tools }));
            server.setRequestHandler(CallToolRequestSchema, async rpc => {
                const name = rpc.params.name;
                const schema = schemas[name];
                if (!schema) return unknownToolResult();
                if (!actor || actor.active !== true) return authenticationRequiredToolResult(resource);
                const parsed = schema.safeParse(rpc.params.arguments === undefined ? {} : rpc.params.arguments);
                if (!parsed.success) return invalidToolInputResult();
                return toolResult(await runOperation({ operation: name, input: parsed.data, actor }));
            });
            const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
            await server.connect(transport);
            return await transport.handleRequest(request);
        } catch {
            return internalErrorResponse();
        }
    };
}
