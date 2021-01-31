const pmap = require("promise.map")
const deepEqual = require("deep-equal")
const { unclean, matches, index_from_sort } = require("./util")

function find(SEA, col, indices, key, retrieve, query, options) {
	return new Promise(async (res, rej) => {
		let docs = []
		let promises = []
		let sort = Object.keys(options.sort).length
		let data

		const index = indices.get(index_from_sort(options.sort))

		await new Promise((res) => {
			index.once(d => {
				if (d) {
					data = d
					col = index
					sort = false
					res()
				} else {
					col.once(d => {
						if (d !== undefined) {
							data = d
							res()
						} else {
							const key = d._["#"]
							retrieve(key, d => {
								data = d
								res()
							})
						}
					})
				}
			})
		})

		const fields = Object.keys(options.fields).length
		const limit = sort ? 0 : options.limit
		const skip = sort ? 0 : options.skip

		if (data) {
			const col_key = data._["#"]
			delete data._
			const entries = Object.entries(data)

			for (let i = skip; i < entries.length; i++) {
				if (limit > 0 && docs.length >= limit) {
					break
				}

				let [id, doc] = entries[i]

				if (doc === undefined) {
					const doc = await new Promise((res) => {
						const key = `${col_key}/${id}`
						retrieve(key, res)
					})
				}

				if (doc) {
					try {
						doc = await SEA.decrypt(doc, key)
						delete doc._
						doc = await unclean(col, doc)
						if (matches(doc, query)) docs.push(doc)
					} catch(e) {
						rej(e)
						return
					}
				}
			}

			if (sort) {
				const entries = Object.entries(options.sort)
				const compare = (a, b, field, asc) => {
					const compareType = (a, b) => {
						if (typeof a === "number" && typeof b == "number"
						|| Object.prototype.toString.call(a) === "[object Date]"
						&& Object.prototype.toString.call(b) === "[object Date]") {
							return a - b
						} else if (typeof a === "string" && typeof b === "string") {
							return a.localeCompare(b)
						}
					}
					return asc === 1
						? compareType(a[field], b[field])
						: compareType(b[field], a[field])
				}

				docs.sort((a, b) => {
					const [field, asc] = entries[0]
					let sort = compare(a, b, field, asc)

					for (let i = 1; i < entries.length; i++) {
						const [field, asc] = entries[i]
						sort = sort || compare(a, b, field, asc)
					}

					return sort
				})

				if (options.skip) {
					docs.splice(0, options.skip)
				}

				if (options.limit > 0 && docs.length > options.limit) {
					docs.splice(options.limit, docs.length - options.limit)
				}
			}

			if (fields) {
				const entries = Object.entries(options.fields)
				const includes = entries.filter(([_, inc]) => inc).map(([field, _]) => field)
				const excludes = entries.filter(([_, inc]) => !inc).map(([field, _]) => field)

				docs = docs.map(doc => {
					const keys = Object.keys(doc)
					for (let i = 0; i < keys.length; i++) {
						const field = keys[i]
						const not_included = includes.length && !includes.includes(field)
						const excluded = excludes.includes(field)
						if (not_included || excluded) {
							delete doc[field]
						}
					}
					return doc
				})
			}

			res(options.one && docs.length === 0 ? null : docs)
		}
	})
}

/*
 * Search through the entire collection and retrieve those who match the query
 * Options:
 *   sort - Fields to sort in ascending or descending order
 *   skip - The amount of documents to skip from the final result
 *   limit - Maximum amount of documents to return
 *   fields - Fields to include/exclude
 */
function Find(SEA, col, indices, key, retrieve, query, options) {
	function sort(sort) {
		return Find(SEA, col, indices, key, retrieve, query, {
			...options,
			sort,
		})
	}

	function skip(skip) {
		return Find(SEA, col, indices, key, retrieve, query, {
			...options,
			skip,
		})
	}

	function limit(limit) {
		return Find(SEA, col, indices, key, retrieve, query, {
			...options,
			limit,
		})
	}

	function fields(fields) {
		return Find(SEA, col, indices, key, retrieve, query, {
			...options,
			fields,
		})
	}

	function one() {
		options.one = true
		options.limit = 1
		return find(SEA, col, indices, key, retrieve, query, options)
	}

	function many() {
		options.one = false
		return find(SEA, col, indices, key, retrieve, query, options)
	}

	return {
		sort,
		skip,
		limit,
		fields,
		one,
		many,
	}
}

module.exports = Find
