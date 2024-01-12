import bodyParser from 'body-parser'
import express from 'express'
import { ecsBaseMiddleware } from '../src/ecs'
import { contextExtractMiddleware } from '../src/middleware'
import { pipeline } from '../src/pipeline'
import {
  todoListComponents,
  todoListStorageMiddleware,
  todoListViewsMiddleware,
} from './todo-list/todo-list-context'
import { register as registerTodoListController } from './todo-list/todo-list-controller'

const context = await pipeline<unknown, unknown>()
  .use(
    ecsBaseMiddleware('todo-mvc-cluster', {
      ...todoListComponents,
    }),
  )
  .use(todoListStorageMiddleware())
  .use(todoListViewsMiddleware())
  .use(contextExtractMiddleware())
  .run({}, {})

const app = express()
app.set('view engine', 'pug')
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static('assets'))

registerTodoListController(app, context)

const PORT = process.env.PORT || 3000
app.listen(PORT)
console.log('Listening on port: ' + PORT)
