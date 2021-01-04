FROM node:15-alpine3.12

RUN apk add python3 make g++ postgresql-client

# set working directory
WORKDIR /app

# add `/app/node_modules/.bin` to $PATH
ENV PATH /app/node_modules/.bin:$PATH

# install app dependencies
COPY package.json ./
COPY yarn.lock ./
RUN yarn install

# add app
COPY . ./

ARG VERSION
ENV VERSION $VERSION

ARG FLEEX_ENV
ENV FLEEX_ENV $FLEEX_ENV

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV

# start app
CMD ["node", "./src/bin/main.js"]