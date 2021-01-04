FROM node:15-alpine3.12

RUN apk add python2 make g++

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

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV

ARG REACT_APP_SERVER_ADDR
ENV REACT_APP_SERVER_ADDR $REACT_APP_SERVER_ADDR

RUN yarn run build

# RUN cat serve.json | sed "s/__VERSION__/${REACT_APP_VERSION}/g" > build/serve.json

# start app
CMD ["node", "node_modules/serve/bin/serve.js", "-s", "build"]
