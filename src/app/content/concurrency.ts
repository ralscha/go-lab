import type { CourseModule } from '../course.model';
const go = String.raw;

export const concurrency: CourseModule = {
  id: 'concurrency',
  title: 'Concurrency with a lifetime',
  level: 'Advanced',
  description: 'Goroutines, channels, cancellation, and synchronized shared state.',
  lessons: [
    {
      id: 'goroutines',
      title: 'Goroutines and joining work',
      summary: 'Start concurrent work and wait for completion deliberately.',
      minutes: 18,
      objectives: ['Start a goroutine', 'Join workers without time.Sleep'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'A go statement starts a function call in a new goroutine. Goroutines are scheduled by the Go runtime and can overlap in time; parallel execution depends on scheduling and resources. Returning from main ends the program without waiting for other goroutines.',
            'sync.WaitGroup coordinates completion. With Add/Done, increment before starting the goroutine and defer Done within it. Wait blocks until the counter reaches zero. A WaitGroup joins tasks; it does not protect shared variables from concurrent mutation.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Never use a sleep as proof that a worker finished. Give every goroutine an owner, a way to finish, and a way for its owner to observe completion. A blocked goroutine consumes resources even when it is not running.',
            'Start with deterministic examples that avoid shared writes. When workers produce results, channels can transfer them to one owner, or a mutex can protect shared state. Race detection checks executed paths, not every possible schedule.',
          ],
        },
      ],
      example: go`package main

import (
	"fmt"
	"sync"
)

func main() {

	var wg sync.WaitGroup

	wg.Add(1)

	go func() {
		defer wg.Done()
		fmt.Println("worker")

	}()

	wg.Wait()

	fmt.Println("joined")

}
`,
      expectedOutput: 'worker\njoined',
      exercise: {
        prompt: 'Wait until the worker closes done before printing finished.',
        hint: 'Receiving from a closed channel completes immediately after it is closed.',
        solution: go`package main

import "fmt"

func main() {

	done := make(chan struct{})

	go func() {
		fmt.Println("work")
		close(done)

	}()

	<-done

	fmt.Println("finished")

}
`,
        starter: go`package main

import "fmt"

func main() {

	done := make(chan struct{})

	go func() {
		fmt.Println("work")
		close(done)

	}()
	/* TODO: wait for completion*/
	fmt.Println("finished")

}
`,
        expectedOutput: 'work\nfinished',
      },
      quiz: {
        question: 'Does WaitGroup protect shared map writes?',
        options: ['Always', 'No', 'Only with one CPU'],
        answer: 1,
        explanation:
          'Joining tasks and synchronizing access to shared state are different responsibilities.',
      },
      references: [
        {
          label: 'sync.WaitGroup',
          url: 'https://pkg.go.dev/sync#WaitGroup',
        },
        {
          label: 'Memory model',
          url: 'https://go.dev/ref/mem',
        },
      ],
      tags: ['goroutines', 'WaitGroup', 'joining'],
    },
    {
      id: 'channels',
      title: 'Channels, buffering, and close',
      summary: 'Transfer values and communicate completion.',
      minutes: 18,
      objectives: ['Explain blocking channel operations', 'Close channels from the sending side'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'A channel transfers values of a specified type. Unbuffered sends rendezvous with a receiver; buffered sends can proceed while capacity is available. Use directional channel types in function signatures to express whether a function sends or receives.',
            'Closing a channel signals that no more values will be sent. A receiver can range until the channel is closed and drained, or use value, ok := <-ch. Once drained, a closed channel yields zero values with ok false.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Sending on a closed channel or closing it twice panics. The component that knows all senders are finished should close it. Receivers usually should not close channels they do not own.',
            'A nil channel blocks both sends and receives forever, which can intentionally disable a select case. Buffering can change throughput but does not fix a missing consumer, a leaked producer, or unclear ownership.',
          ],
        },
      ],
      example: go`package main

import "fmt"

func produce(out chan<- int) {

	defer close(out)

	for n := 1; n <= 3; n++ {

		out <- n

	}

}
func main() {

	values := make(chan int)

	go produce(values)

	sum := 0

	for n := range values {

		sum += n

	}

	fmt.Println(sum)

}
`,
      expectedOutput: '6',
      exercise: {
        prompt: 'Accumulate all received values before printing.',
        hint: 'A range over a channel ends after close and drain.',
        solution: go`package main

import "fmt"

func main() {

	ch := make(chan int, 3)

	ch <- 2

	ch <- 4

	ch <- 6

	close(ch)

	total := 0

	for n := range ch {

		total += n

	}

	fmt.Println(total)

}
`,
        starter: go`package main

import "fmt"

func main() {

	ch := make(chan int, 3)

	ch <- 2

	ch <- 4

	ch <- 6

	close(ch)

	total := 0

	for n := range ch {

		total = n

	}

	fmt.Println(total)

}
`,
        expectedOutput: '12',
      },
      quiz: {
        question: 'Who should normally close a channel?',
        options: [
          'Any receiver that is bored',
          'Every sender independently',
          'The owner of the sending lifecycle',
        ],
        answer: 2,
        explanation: 'Close only when it is known that all sends have finished.',
      },
      references: [
        {
          label: 'Channel types',
          url: 'https://go.dev/ref/spec#Channel_types',
        },
        {
          label: 'Channels',
          url: 'https://go.dev/doc/effective_go#channels',
        },
      ],
      tags: ['channels', 'buffering', 'close'],
    },
    {
      id: 'context',
      title: 'Select and context cancellation',
      summary: 'Let callers stop work without leaking goroutines.',
      minutes: 18,
      objectives: [
        'Propagate context through operations',
        'Make blocking sends cancellation-aware',
      ],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'select waits for a ready communication case. When several are ready it chooses one; source order is not a priority rule. A default case makes the operation non-blocking and can create a busy loop if used carelessly.',
            'context.Context carries deadlines, cancellation, and request-scoped values. Pass it as the first parameter to operations that can block. Derive a context with WithCancel or WithTimeout and call its cancel function to release associated resources.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Cancellation is cooperative: closing Done does not forcibly terminate a goroutine. The worker must observe it, including while waiting to send a result. Select between the communication and ctx.Done so downstream abandonment can release a producer.',
            'Do not put optional configuration or arbitrary global state in context values. A cancelled context remains cancelled; create an appropriate new context for independent work.',
          ],
        },
      ],
      example: go`package main

import (
	"context"
	"fmt"
)

func main() {

	ctx, cancel := context.WithCancel(context.Background())

	cancel()

	select {

	case <-ctx.Done():

		fmt.Println(ctx.Err())

	default:

		fmt.Println("active")

	}

}
`,
      expectedOutput: 'context canceled',
      exercise: {
        prompt: 'Return on cancellation instead of trying to send to an unconsumed channel.',
        hint: 'Include ctx.Done in the select.',
        solution: go`package main

import (
	"context"
	"fmt"
)

func send(ctx context.Context, out chan<- int) error {

	select {

	case out <- 1:

		return nil

	case <-ctx.Done():

		return ctx.Err()

	}

}
func main() {

	ctx, cancel := context.WithCancel(context.Background())

	cancel()

	fmt.Println(send(ctx, make(chan int)))

}
`,
        starter: go`package main

import (
	"context"
	"fmt"
)

func send(ctx context.Context, out chan<- int) error {

	select {

	case out <- 1:

		return nil

	default:

		return nil
		/* TODO: report cancellation*/

	}

}
func main() {

	ctx, cancel := context.WithCancel(context.Background())

	cancel()

	fmt.Println(send(ctx, make(chan int)))

}
`,
        expectedOutput: 'context canceled',
      },
      quiz: {
        question: 'Does cancelling context forcibly kill a goroutine?',
        options: ['Yes', 'No', 'Only for HTTP handlers'],
        answer: 1,
        explanation:
          'Workers must cooperate by observing Done or passing the context to aware APIs.',
      },
      references: [
        {
          label: 'context',
          url: 'https://pkg.go.dev/context',
        },
        {
          label: 'Select statements',
          url: 'https://go.dev/ref/spec#Select_statements',
        },
      ],
      tags: ['context', 'select', 'cancellation', 'deadlines'],
    },
    {
      id: 'synchronization',
      title: 'Mutexes, atomics, and race detection',
      summary: 'Protect invariants across concurrent access.',
      minutes: 18,
      objectives: ['Guard a shared invariant with a mutex', 'Interpret race detector results'],
      sections: [
        {
          title: 'Understand the model',
          body: [
            'A mutex grants exclusive access to a critical section. Protect every access to the shared state with the same lock, including reads. Keep the invariant and the lock together in one type. A deferred Unlock is useful when the critical section spans a function.',
            'Atomic operations support certain low-level shared values, but several atomic fields do not automatically form a consistent transaction. Prefer a mutex when several values must change together. The memory model defines synchronization guarantees; wall-clock timing is not synchronization.',
          ],
        },
        {
          title: 'Apply it carefully',
          body: [
            'Never copy a mutex after use. Avoid holding a lock while making an unrelated blocking call, and establish a lock order if multiple locks are required. sync.Map is specialized and does not replace every map with a mutex.',
            'Run go test -race ./... locally, or choose Race detector in this playground. A clean run covers only exercised execution paths. Race detection adds overhead and requires platform/toolchain support.',
          ],
        },
      ],
      example: go`package main

import (
	"fmt"
	"sync"
)

func main() {

	var mu sync.Mutex

	var wg sync.WaitGroup

	count := 0

	for i := 0; i < 4; i++ {

		wg.Add(1)

		go func() {
			defer wg.Done()
			mu.Lock()
			count++
			mu.Unlock()

		}()

	}

	wg.Wait()

	fmt.Println(count)

}
`,
      expectedOutput: '4',
      exercise: {
        prompt: 'Count every worker using an atomic increment.',
        hint: 'Add changes the existing value; Store replaces it.',
        solution: go`package main

import (
	"fmt"
	"sync"
	"sync/atomic"
)

func main() {

	var count atomic.Int64

	var wg sync.WaitGroup

	for i := 0; i < 4; i++ {

		wg.Add(1)

		go func() {
			defer wg.Done()
			count.Add(1)

		}()

	}

	wg.Wait()

	fmt.Println(count.Load())

}
`,
        starter: go`package main

import (
	"fmt"
	"sync"
	"sync/atomic"
)

func main() {

	var count atomic.Int64

	var wg sync.WaitGroup

	for i := 0; i < 4; i++ {

		wg.Add(1)

		go func() {
			defer wg.Done()
			count.Store(1)

		}()

	}

	wg.Wait()

	fmt.Println(count.Load())

}
`,
        expectedOutput: '4',
      },
      quiz: {
        question: 'Does a clean race detector run prove all schedules are safe?',
        options: ['No', 'Yes', 'Only for maps'],
        answer: 0,
        explanation: 'The detector finds races on paths that execute during the run.',
      },
      references: [
        {
          label: 'sync',
          url: 'https://pkg.go.dev/sync',
        },
        {
          label: 'Race detector',
          url: 'https://go.dev/doc/articles/race_detector',
        },
        {
          label: 'sync/atomic',
          url: 'https://pkg.go.dev/sync/atomic',
        },
      ],
      tags: ['mutex', 'atomic', 'race detector'],
    },
  ],
};
