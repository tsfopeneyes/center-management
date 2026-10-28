-- Catalog policy structure only; do not execute policies or inspect rows.
SELECT n.nspname AS schema,c.relname AS table,p.polname AS policy,p.polcmd AS command,p.polpermissive AS permissive,
 ARRAY(SELECT CASE WHEN r=0 THEN 'PUBLIC' ELSE pg_get_userbyid(r) END FROM unnest(p.polroles) AS r) AS roles,
 pg_get_expr(p.polqual,p.polrelid) AS using_expression
FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('users','locations','logs','notices','notice_responses') AND NOT p.polpermissive;
