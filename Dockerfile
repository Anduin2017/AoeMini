# ============================
# Prepare Build Environment
FROM hub.aiursoft.com/node:21-alpine AS npm-env
WORKDIR /src
COPY . .
RUN npm install --loglevel verbose
# 使用 prod 命令构建，确保使用相对路径(--base ./)并输出到 dist
RUN npm run prod

# ============================
# Prepare Runtime Environment
FROM hub.aiursoft.com/aiursoft/static
# 关键修改：只将构建生成的 dist 目录内容复制到静态服务器根目录
COPY --from=npm-env /src/dist /data