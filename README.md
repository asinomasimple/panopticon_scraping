# Panopticon Scraping

A scraping service that stores QBN entries in a dabase using Node.js.  
Panopticon is for the people, the people are not for Panopticon.

## Table of Contents

- [Project Overview](#project-overview)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Usage](#usage)
- [Folder Structure](#folder-structure)
- [Contributing](#contributing)
- [License](#license)

## Project Overview

This project scrapes a website and stores it in a database. The project consists of several components:

- `database.js`: Checks and inserts data into a MySQL database.
- `fetch.js`: Responsible for fetching web pages using Axios.
- `process.js`: Parses the retrieved pages using Cheerio to extract data.
- `index.js`: The main script that orchestrates the entire scraping process.

## Getting Started

### Prerequisites

Before running the project, ensure you have the following installed:

- Node.js
- MySQL database (with proper credentials)

### Installation

1. Clone this repository:

   ```shell
   git clone https://github.com/asinomasimple/panopticon_scraping.git
  
  
## Content types

### Reply
A reply represents a single post by a user made inside a topic. Notes are attached to a reply.  
url: https://www.qbn.com/reply/1/

- scraping_replies.js 
- process_replies.js  
- db_replies.js.

**Database table**: `replies`  
**Fields:**  
`id` INT(7) NOT NULL.  
The primary key identifier for the reply, retrieved from the 'data-id' attribute of the 'div.flagger' element.

`status` INT(11) DEFAULT NULL.  
The URL HTTP status code, useful to check for deleted replies with a status of 404.

`created` DATETIME DEFAULT NULL.  
The date retrieved from the link with class "created" attribute date.

`user` VARCHAR(30) DEFAULT NULL.  
The username retrieved from the link with class "user".

`topic_id` INT(8) DEFAULT NULL.  
The ID of the parent topic retrieved from the h1 element.

`topic_title` VARCHAR(80) DEFAULT NULL.  
The title of the parent topic retrieved from the h1 element.

`post` LONGTEXT.  
The content of the reply retrieved from dd.main > div.body.

`notes` MEDIUMTEXT.  
(Deprecated since 2024) The sidenotes/comments retrieved from dd.notes. Notes are now stored in their own table.

`score` INT(11) DEFAULT NULL.  
The result from the number of upvotes and downvotes retrieved from span.score.

`reply_number` INT(11) DEFAULT NULL.  
The position of the reply inside the parent topic retrieved from h2 > a.


### Topic  
A topic is a collection of replies under a same theme, also called a "tread". Topics are also used to store profiles and NT posts.

- scraping_topics.js 
- process_topics.js  
- db_topics.js.

#### Topic types
There are three types of topic: thread, profile and nt.

**thread**
Thread url: https://www.qbn.com/topics/304853-happy-very/
Thread url before redirect: https://www.qbn.com/topics/304853/ 
The typical thread type, these are titles that appear on the left hand menu. The first post on a thread type topic is not a reply. 

**profile**
Profile url: https://www.qbn.com/unknown/  
Topic url: https://www.qbn.com/reply/3894265/

For profiles their topic urls won't redirect, if accessing from a topic url you need to follow the 'View thread', the username should be the first post. The first post is not a reply, it's t he user's bio.

**nt**
NT url: https://www.qbn.com/topics/775543-revenge-suko-pyramid/ 
NT url before redirect: https://www.qbn.com/topics/775543/

NT type topics are available at https://www.qbn.com/today/ 
Unlike thread types they feature an image and link.


**Database table**: `topics`  
**Fields:**  

`id` int(11) NOT NULL,   
The primary key identifier for the topic, retrieved from the 'data-id' attribute of the 'div.flagger' element.  

`status` int(11) NOT NULL,  
The URL HTTP status code, useful to check for deleted replies with a status of 404.  

`title` varchar(255) COLLATE utf8_unicode_ci NOT NULL,  
The title retrieved from the h1 element.  

`date` varchar(255) COLLATE utf8_unicode_ci NOT NULL,  
The date the topic was created retrieved from #meta span.date.

`post` text COLLATE utf8_unicode_ci NOT NULL,  
The content of the first post, this is not a reply type content. 
Retrieved from dd.main > div.body

`user` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,  
Retrieved from dd.main > div.meta > a

`topic_type` enum('nt','thread','profile','deleted') COLLATE utf8_unicode_ci DEFAULT NULL  
Getting the correct topic type from a url is complicated and so far there's no 100% sure way we are getting the correct topic type specially for topics from the first years.  
In the database there are entries in the `profiles` table that are of type 'nt'. 