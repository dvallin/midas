import bodyParser from 'body-parser'
import express from 'express'
import { ecsBaseMiddleware } from '../../ecs/ecs-core'
import {
  contextExtractMiddleware,
  pipeline,
} from '../../middleware/middleware-core'
import {
  todoListComponents,
  todoListStorageMiddleware,
  todoListViewsMiddleware,
} from './todo-list/todo-list-context'
import { register as registerTodoListController } from './todo-list/todo-list-controller'

async function run() {
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
  app.use(express.static('editor/assets'))

  registerTodoListController(app, context)

  const PORT = process.env.PORT || 3000
  app.listen(PORT)
  console.log('Listening on port: ' + PORT)
}

run()
