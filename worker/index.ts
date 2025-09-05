export default {
    /* eslint-disable */
    fetch: async (request, env) => {
        void request;
        void env;
        return new Response(null, { status: 404 });
    },
} satisfies ExportedHandler<Env>;
