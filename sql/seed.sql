-- Seed file for importing topics data

-- First, clear existing topics (optional, remove if you want to append)
-- truncate table topics restart identity cascade;

-- Import topics from CSV
-- Note: This uses PostgreSQL's COPY command
-- The CSV should have headers matching: category,topic,word1,word2,word3,word4,word5,word6,word7,word8,family_safe

-- For Supabase, use the SQL editor to run:
-- \copy topics (category, topic, word1, word2, word3, word4, word5, word6, word7, word8, family_safe) 
-- FROM 'topics_cards.csv' 
-- WITH (FORMAT csv, HEADER true);

-- Alternative: If using Supabase Dashboard, you can use the Table Editor import feature
-- Or insert manually with sample data:

INSERT INTO topics (category, topic, word1, word2, word3, word4, word5, word6, word7, word8, family_safe) VALUES
-- Food & Drink
('Pizza Toppings', 'Pizza Toppings', 'Pepperoni', 'Mushrooms', 'Pineapple', 'Sausage', 'Olives', 'Onions', 'Bacon', 'Peppers', true),
('Ice Cream Flavors', 'Ice Cream Flavors', 'Vanilla', 'Chocolate', 'Strawberry', 'Mint', 'Cookie Dough', 'Rocky Road', 'Pistachio', 'Caramel', true),
('Breakfast Foods', 'Breakfast Foods', 'Pancakes', 'Eggs', 'Bacon', 'Toast', 'Cereal', 'Oatmeal', 'Waffles', 'Yogurt', true),
('Fruits', 'Fruits', 'Apple', 'Banana', 'Orange', 'Strawberry', 'Grape', 'Watermelon', 'Mango', 'Pineapple', true),
('Vegetables', 'Vegetables', 'Carrot', 'Broccoli', 'Tomato', 'Potato', 'Onion', 'Lettuce', 'Cucumber', 'Corn', true),

-- Beach & Ocean
('Beach Gear', 'Beach Gear', 'Surfboard', 'Towel', 'Sunscreen', 'Flip-Flops', 'Beach Ball', 'Cooler', 'Chair', 'Swimsuit', true),
('Ocean Animals', 'Ocean Animals', 'Shark', 'Dolphin', 'Whale', 'Octopus', 'Jellyfish', 'Sea Turtle', 'Starfish', 'Crab', true),
('Beach Activities', 'Beach Activities', 'Swimming', 'Surfing', 'Volleyball', 'Sandcastle', 'Sunbathing', 'Snorkeling', 'Fishing', 'Walking', true),

-- Sports & Games
('Sports', 'Sports', 'Soccer', 'Basketball', 'Tennis', 'Baseball', 'Golf', 'Football', 'Hockey', 'Swimming', true),
('Board Games', 'Board Games', 'Monopoly', 'Chess', 'Checkers', 'Scrabble', 'Risk', 'Clue', 'Sorry', 'Life', true),
('Video Games', 'Video Games', 'Mario', 'Zelda', 'Minecraft', 'Fortnite', 'Pokemon', 'Tetris', 'Pac-Man', 'Sonic', true),

-- Animals
('Pets', 'Pets', 'Dog', 'Cat', 'Fish', 'Bird', 'Hamster', 'Rabbit', 'Snake', 'Turtle', true),
('Farm Animals', 'Farm Animals', 'Cow', 'Pig', 'Chicken', 'Horse', 'Sheep', 'Goat', 'Duck', 'Turkey', true),
('Zoo Animals', 'Zoo Animals', 'Lion', 'Elephant', 'Giraffe', 'Monkey', 'Zebra', 'Bear', 'Tiger', 'Penguin', true),
('Birds', 'Birds', 'Eagle', 'Owl', 'Parrot', 'Robin', 'Hawk', 'Crow', 'Flamingo', 'Peacock', true),

-- Places & Travel
('Countries', 'Countries', 'USA', 'Canada', 'Mexico', 'Brazil', 'France', 'Japan', 'Australia', 'Egypt', true),
('US Cities', 'US Cities', 'New York', 'Los Angeles', 'Chicago', 'Houston', 'Miami', 'Seattle', 'Boston', 'Denver', true),
('Vacation Spots', 'Vacation Spots', 'Beach', 'Mountains', 'Cruise', 'Disney', 'Paris', 'Hawaii', 'Vegas', 'Camping', true),
('Room in House', 'Room in House', 'Kitchen', 'Bedroom', 'Bathroom', 'Living Room', 'Garage', 'Basement', 'Attic', 'Office', true),

-- School & Work
('School Subjects', 'School Subjects', 'Math', 'Science', 'English', 'History', 'Art', 'Music', 'PE', 'Geography', true),
('School Supplies', 'School Supplies', 'Pencil', 'Paper', 'Eraser', 'Backpack', 'Notebook', 'Ruler', 'Glue', 'Scissors', true),
('Jobs', 'Jobs', 'Doctor', 'Teacher', 'Police', 'Firefighter', 'Chef', 'Pilot', 'Artist', 'Farmer', true),

-- Entertainment
('Movies', 'Movies', 'Star Wars', 'Harry Potter', 'Marvel', 'Disney', 'Jurassic Park', 'Toy Story', 'Frozen', 'Avatar', true),
('Music Genres', 'Music Genres', 'Rock', 'Pop', 'Jazz', 'Classical', 'Hip Hop', 'Country', 'Electronic', 'Blues', true),
('Instruments', 'Instruments', 'Piano', 'Guitar', 'Drums', 'Violin', 'Trumpet', 'Flute', 'Saxophone', 'Bass', true),
('TV Shows', 'TV Shows', 'Friends', 'The Office', 'Simpsons', 'SpongeBob', 'Stranger Things', 'Game of Thrones', 'Breaking Bad', 'Mandalorian', true),

-- Everyday Items
('Clothing', 'Clothing', 'Shirt', 'Pants', 'Shoes', 'Hat', 'Jacket', 'Socks', 'Dress', 'Gloves', true),
('Colors', 'Colors', 'Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Black', 'White', true),
('Weather', 'Weather', 'Sunny', 'Rainy', 'Cloudy', 'Snowy', 'Windy', 'Foggy', 'Stormy', 'Hot', true),
('Emotions', 'Emotions', 'Happy', 'Sad', 'Angry', 'Scared', 'Excited', 'Nervous', 'Surprised', 'Confused', true),
('Body Parts', 'Body Parts', 'Head', 'Arm', 'Leg', 'Hand', 'Foot', 'Eye', 'Ear', 'Nose', true),

-- Technology
('Social Media', 'Social Media', 'Facebook', 'Instagram', 'Twitter', 'TikTok', 'Snapchat', 'YouTube', 'LinkedIn', 'Reddit', true),
('Computer Parts', 'Computer Parts', 'Monitor', 'Keyboard', 'Mouse', 'CPU', 'RAM', 'Hard Drive', 'Graphics Card', 'Motherboard', true),
('Phone Apps', 'Phone Apps', 'Messages', 'Camera', 'Maps', 'Email', 'Calendar', 'Music', 'Games', 'Weather', true),

-- Holidays & Seasons
('Holidays', 'Holidays', 'Christmas', 'Halloween', 'Thanksgiving', 'Easter', 'July 4th', 'Valentines', 'New Years', 'Birthday', true),
('Seasons', 'Seasons', 'Spring', 'Summer', 'Fall', 'Winter', 'Rainy', 'Dry', 'Hurricane', 'Monsoon', true),
('Christmas', 'Christmas', 'Tree', 'Santa', 'Presents', 'Reindeer', 'Stockings', 'Cookies', 'Snow', 'Lights', true),
('Halloween', 'Halloween', 'Pumpkin', 'Costume', 'Candy', 'Ghost', 'Witch', 'Vampire', 'Skeleton', 'Spider', true),

-- Transportation
('Vehicles', 'Vehicles', 'Car', 'Truck', 'Motorcycle', 'Bus', 'Train', 'Airplane', 'Boat', 'Bicycle', true),
('Car Brands', 'Car Brands', 'Toyota', 'Ford', 'Honda', 'Tesla', 'BMW', 'Mercedes', 'Jeep', 'Chevrolet', true),

-- More Fun Topics
('Superheroes', 'Superheroes', 'Superman', 'Batman', 'Spider-Man', 'Iron Man', 'Wonder Woman', 'Hulk', 'Thor', 'Captain America', true),
('Disney Movies', 'Disney Movies', 'Lion King', 'Frozen', 'Moana', 'Aladdin', 'Beauty Beast', 'Little Mermaid', 'Toy Story', 'Finding Nemo', true),
('Candy', 'Candy', 'Chocolate', 'Gummies', 'Lollipop', 'Skittles', 'M&Ms', 'Snickers', 'Twix', 'Sour Patch', true),
('Fast Food', 'Fast Food', 'McDonalds', 'Burger King', 'Subway', 'KFC', 'Taco Bell', 'Wendys', 'Chipotle', 'Pizza Hut', true),
('Drinks', 'Drinks', 'Water', 'Soda', 'Juice', 'Coffee', 'Tea', 'Milk', 'Smoothie', 'Lemonade', true),
('Desserts', 'Desserts', 'Cake', 'Ice Cream', 'Cookies', 'Pie', 'Brownies', 'Donuts', 'Pudding', 'Candy', true),
('Hobbies', 'Hobbies', 'Reading', 'Gaming', 'Cooking', 'Gardening', 'Painting', 'Dancing', 'Fishing', 'Photography', true),
('Tools', 'Tools', 'Hammer', 'Screwdriver', 'Wrench', 'Drill', 'Saw', 'Pliers', 'Tape Measure', 'Level', true),
('Kitchen Items', 'Kitchen Items', 'Stove', 'Refrigerator', 'Microwave', 'Toaster', 'Blender', 'Dishwasher', 'Oven', 'Sink', true),
('Bathroom Items', 'Bathroom Items', 'Toilet', 'Shower', 'Sink', 'Mirror', 'Towel', 'Soap', 'Toothbrush', 'Shampoo', true);

-- Create some test rooms for development
INSERT INTO rooms (code, status, max_players, win_target, family_safe_only) VALUES
('TEST01', 'lobby', 8, 5, true),
('TEST02', 'lobby', 12, 7, true);

-- Function to get random topic respecting family_safe filter
CREATE OR REPLACE FUNCTION get_random_topic(family_safe_only boolean)
RETURNS SETOF topics AS $$
BEGIN
  IF family_safe_only THEN
    RETURN QUERY 
    SELECT * FROM topics 
    WHERE family_safe = true 
    ORDER BY random() 
    LIMIT 1;
  ELSE
    RETURN QUERY 
    SELECT * FROM topics 
    ORDER BY random() 
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql;